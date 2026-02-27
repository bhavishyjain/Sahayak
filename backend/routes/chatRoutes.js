const express = require("express");
const router = express.Router();
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { analyze } = require("../services/geminiService");
const Complaint = require("../models/Complaint");
const { attachAuth } = require("../middlewares/jwtAuth");

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("audio/") ||
      file.mimetype === "application/octet-stream"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function getGeminiApiKey() {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) return "";
  return String(raw).trim().replace(/^['\"]|['\"]$/g, "");
}

function getOpenAIApiKey() {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return "";
  return String(raw).trim().replace(/^['\"]|['\"]$/g, "");
}

const genAI = getGeminiApiKey()
  ? new GoogleGenerativeAI(getGeminiApiKey())
  : null;

const CHAT_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview"];
router.use(attachAuth);

function wantsRecentComplaints(message = "") {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("meri complaint") ||
    lower.includes("meri complaints") ||
    lower.includes("meri shikayat") ||
    lower.includes("my complaint") ||
    lower.includes("my complaints") ||
    lower.includes("recent complaint") ||
    lower.includes("complaint history")
  );
}

function extractTicketId(message = "") {
  const match = String(message || "").match(/\b[A-Z]{2,5}\d{3,8}\b/i);
  return match ? match[0].toUpperCase() : null;
}

function canAccessComplaint(user, complaint) {
  if (!user?._id) return false;
  if (["admin", "head", "worker"].includes(user.role)) return true;
  return String(complaint.userId) === String(user._id);
}

function resolveAudioMimeType(mimetype = "", originalname = "") {
  const normalized = String(mimetype || "").toLowerCase();
  const fileName = String(originalname || "").toLowerCase();

  if (
    normalized === "audio/m4a" ||
    normalized === "audio/x-m4a" ||
    normalized === "audio/mp4" ||
    fileName.endsWith(".m4a")
  ) {
    return "audio/mp4";
  }

  if (normalized === "application/octet-stream") {
    if (fileName.endsWith(".m4a") || fileName.endsWith(".aac")) return "audio/mp4";
    if (fileName.endsWith(".mp4")) return "audio/mp4";
    if (fileName.endsWith(".wav")) return "audio/wav";
    if (fileName.endsWith(".mp3")) return "audio/mpeg";
  }

  return normalized || "audio/mp4";
}

async function generateWithModel(modelName, prompt, inlineAudio = null) {
  const model = genAI.getGenerativeModel({ model: modelName });
  const parts = [];
  if (inlineAudio) parts.push({ inlineData: inlineAudio });
  parts.push(prompt);
  const result = await model.generateContent(parts);
  return result.response.text().trim();
}

async function runGeminiWithFallback(prompt, inlineAudio = null) {
  let lastError = null;
  for (const modelName of CHAT_MODELS) {
    try {
      return await generateWithModel(modelName, prompt, inlineAudio);
    } catch (error) {
      lastError = error;
      console.error(`Gemini model ${modelName} failed:`, error?.message || error);
    }
  }
  throw lastError || new Error("No Gemini model available");
}

async function transcribeWithWhisper(reqFile) {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const mimeType = resolveAudioMimeType(reqFile.mimetype, reqFile.originalname);
  const fileName = reqFile.originalname || "recording.m4a";
  const form = new FormData();
  form.append(
    "file",
    new Blob([reqFile.buffer], { type: mimeType }),
    fileName
  );
  form.append("model", "whisper-1");
  form.append("response_format", "json");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Whisper STT request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error ||
      `Whisper request failed (${response.status})`;
    throw new Error(message);
  }

  const text = String(data?.text || "").trim();
  if (!text) {
    throw new Error("Whisper returned an empty transcription");
  }
  return text;
}

router.post("/message", async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const lowerMessage = String(message || "").toLowerCase();

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (wantsRecentComplaints(message)) {
      if (!req.user?._id) {
        return res.json({
          response:
            "Please login first, then I can show your recent complaints.",
          assistant: { intent: "status_list", found: false, complaints: [] },
          timestamp: new Date().toISOString(),
        });
      }

      const complaints = await Complaint.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("ticketId status department priority createdAt");

      if (!complaints.length) {
        return res.json({
          response: "Aapki abhi tak koi complaint register nahi hai.",
          assistant: { intent: "status_list", found: false, complaints: [] },
          timestamp: new Date().toISOString(),
        });
      }

      const summary = complaints
        .map(
          (c, i) =>
            `${i + 1}. ${c.ticketId} - ${c.status} (${c.department}, ${c.priority})`
        )
        .join("\n");

      return res.json({
        response: `Yeh aapki recent complaints hain:\n${summary}`,
        assistant: {
          intent: "status_list",
          found: true,
          complaints,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const ticketId = extractTicketId(message);
    if (ticketId && (lowerMessage.includes("status") || lowerMessage.includes("track"))) {
      if (!req.user?._id) {
        return res.status(401).json({
          error: "Authentication required to check ticket status",
        });
      }

      const complaint = await Complaint.findOne({ ticketId });
      if (!complaint) {
        return res.json({
          response: `Ticket ${ticketId} nahi mila.`,
          assistant: { intent: "status_query", found: false, ticketId },
          timestamp: new Date().toISOString(),
        });
      }

      if (!canAccessComplaint(req.user, complaint)) {
        return res.status(403).json({
          error: "You are not allowed to access this ticket",
        });
      }

      return res.json({
        response: `Ticket ${complaint.ticketId} ka status ${complaint.status} hai.`,
        assistant: {
          intent: "status_query",
          found: true,
          complaint: {
            id: complaint._id,
            ticketId: complaint.ticketId,
            status: complaint.status,
            department: complaint.department,
            priority: complaint.priority,
          },
        },
        timestamp: new Date().toISOString(),
      });
    }

    const response = await generateChatResponse(message, conversationHistory);

    return res.json({
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: "Failed to generate response" });
  }
});

router.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const sttProvider = (process.env.STT_PROVIDER || "whisper").toLowerCase();
    let transcription = "";

    if (sttProvider === "whisper") {
      transcription = await transcribeWithWhisper(req.file);
    } else {
      if (!genAI) {
        return res.status(500).json({
          error: "Speech recognition service not available - Gemini API key missing",
        });
      }
      const base64Audio = req.file.buffer.toString("base64");
      const mimeType = resolveAudioMimeType(req.file.mimetype, req.file.originalname);
      const prompt =
        "Please transcribe this audio file to text. Only return the transcribed text, nothing else.";
      transcription = await runGeminiWithFallback(prompt, {
        data: base64Audio,
        mimeType,
      });
    }

    if (!transcription) {
      return res.status(422).json({ error: "No speech detected" });
    }

    return res.json({ text: transcription });
  } catch (error) {
    console.error("Speech-to-text error:", error);
    return res.status(500).json({
      error: "Failed to transcribe audio",
      details: error?.message || "Unknown speech transcription error",
    });
  }
});

async function generateChatResponse(message, conversationHistory = []) {
  const lowerMessage = String(message || "").toLowerCase();

  if (
    lowerMessage.includes("complaint") ||
    lowerMessage.includes("problem") ||
    lowerMessage.includes("issue") ||
    lowerMessage.includes("report")
  ) {
    try {
      const analysis = await analyze(message);

      if (analysis.type === "newComplaint") {
        return `I understand you want to report: "${analysis.refinedText}". This appears to be a ${analysis.department} department issue with ${analysis.priority} priority. Would you like me to help you register this complaint? Please provide your location details if you'd like to proceed.`;
      }

      if (analysis.type === "statusQuery") {
        return "I can help you check your complaint status. Please provide your complaint ID, or I can look up your most recent complaint if you're logged in.";
      }
    } catch (error) {
      console.error("Analysis error:", error);
    }
  }

  if (genAI) {
    try {
      const context =
        conversationHistory.length > 0
          ? `Previous conversation:\n${conversationHistory
              .map((msg) => `${msg.sender}: ${msg.text}`)
              .join("\n")}\n\n`
          : "";

      const prompt = `${context}You are a helpful municipal assistant chatbot. The user is interacting with a municipal complaints system.

Respond helpfully to their query: "${message}"

Keep responses concise, friendly, and relevant to municipal services. If they ask about complaints, guide them to register or check status.

Available services:
- Complaint registration
- Complaint status tracking
- Information about municipal services
- Office hours and contact information

Respond in a conversational tone.`;

      return await runGeminiWithFallback(prompt);
    } catch (error) {
      console.error("Gemini chat error:", error);
    }
  }

  if (lowerMessage.includes("hello") || lowerMessage.includes("hi") || lowerMessage.includes("hey")) {
    return "Hello! I'm your municipal assistant. I can help you register complaints, check complaint status, or provide information about our services. How can I assist you today?";
  }

  if (lowerMessage.includes("help")) {
    return "I can assist you with:\n• Registering new complaints\n• Checking complaint status\n• Information about municipal services\n• Office hours and contact details\n• Service procedures\n\nWhat would you like to know more about?";
  }

  if (lowerMessage.includes("office hours") || lowerMessage.includes("timing")) {
    return "Our office hours are:\nMonday-Friday: 9:00 AM - 6:00 PM\nSaturday: 9:00 AM - 2:00 PM\nNo service on Sundays and public holidays.";
  }

  if (lowerMessage.includes("contact") || lowerMessage.includes("phone")) {
    return "You can reach us at:\nPhone: 1800-123-4567\nEmail: complaints@municipality.gov\nAddress: Municipal Corporation Office, 123 Civic Center";
  }

  return "I understand you need assistance. I can help you register complaints, check status, or provide information about municipal services. Could you please be more specific about what you need help with?";
}

module.exports = router;
