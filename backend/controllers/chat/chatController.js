const Complaint = require("../../models/Complaint");
const { audioUpload } = require("../../middlewares/multer");
const {
  hasGeminiClient,
  runGeminiWithFallback,
  generateChatResponse,
} = require("../../services/chatAssistantService");
const {
  extractTicketId,
  findComplaintByTicketId,
  findRecentComplaintsForUser,
  wantsRecentComplaints,
  canUserAccessComplaint,
} = require("../../services/complaintLookupService");

function getOpenAIApiKey() {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return "";
  return String(raw)
    .trim()
    .replace(/^['\"]|['\"]$/g, "");
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
    if (fileName.endsWith(".m4a") || fileName.endsWith(".aac")) {
      return "audio/mp4";
    }
    if (fileName.endsWith(".mp4")) return "audio/mp4";
    if (fileName.endsWith(".wav")) return "audio/wav";
    if (fileName.endsWith(".mp3")) return "audio/mpeg";
  }

  return normalized || "audio/mp4";
}

async function transcribeWithWhisper(reqFile) {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const mimeType = resolveAudioMimeType(reqFile.mimetype, reqFile.originalname);
  const fileName = reqFile.originalname || "recording.m4a";
  const form = new FormData();
  form.append("file", new Blob([reqFile.buffer], { type: mimeType }), fileName);
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

async function handleMessage(req, res) {
  try {
    const { message, conversationHistory = [] } = req.body;
    const lowerMessage = String(message || "").toLowerCase();

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (wantsRecentComplaints(message)) {
      if (!req.user?._id) {
        return res.json({
          response: "Please login first, then I can show your recent complaints.",
          assistant: { intent: "status_list", found: false, complaints: [] },
          timestamp: new Date().toISOString(),
        });
      }

      const complaints = await findRecentComplaintsForUser(req.user._id, 5);

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
            `${i + 1}. ${c.ticketId} - ${c.status} (${c.department}, ${c.priority})`,
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
    if (
      ticketId &&
      (lowerMessage.includes("status") || lowerMessage.includes("track"))
    ) {
      if (!req.user?._id) {
        return res.status(401).json({
          error: "Authentication required to check ticket status",
        });
      }

      const complaint = await findComplaintByTicketId(ticketId);
      if (!complaint) {
        return res.json({
          response: `Ticket ${ticketId} nahi mila.`,
          assistant: { intent: "status_query", found: false, ticketId },
          timestamp: new Date().toISOString(),
        });
      }

      if (!(await canUserAccessComplaint(req.user, complaint))) {
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
}

async function handleSpeechToText(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const sttProvider = (process.env.STT_PROVIDER || "whisper").toLowerCase();
    let transcription = "";

    if (sttProvider === "whisper") {
      transcription = await transcribeWithWhisper(req.file);
    } else {
      if (!hasGeminiClient()) {
        return res.status(500).json({
          error:
            "Speech recognition service not available - Gemini API key missing",
        });
      }
      const base64Audio = req.file.buffer.toString("base64");
      const mimeType = resolveAudioMimeType(
        req.file.mimetype,
        req.file.originalname,
      );
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
}

module.exports = { handleMessage, handleSpeechToText };
