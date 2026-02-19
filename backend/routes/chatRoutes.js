const express = require("express");
const router = express.Router();
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { analyze } = require("../services/geminiService");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const generateTicketId = require("../utils/generateTicketId");
const { notifyUser } = require("../controllers/api/notificationController");
const { attachAuth } = require("../middlewares/jwtAuth");

// Configure multer for audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Accept audio files
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
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const SUPPORTED_LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  gu: "Gujarati",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ur: "Urdu",
};

router.use(attachAuth);

function normalizeDepartment(department) {
  const valid = ["road", "water", "electricity", "waste", "drainage", "other"];
  return valid.includes(department) ? department : "other";
}

function normalizePriority(priority) {
  return ["Low", "Medium", "High"].includes(priority) ? priority : "Medium";
}

function buildDraftFromAnalysis(message, analysis = {}) {
  const refinedText = (analysis.refinedText || message || "").trim();
  return {
    title:
      refinedText.length > 72
        ? `${refinedText.slice(0, 69).trim()}...`
        : refinedText || "Complaint",
    description: refinedText || message,
    department: normalizeDepartment(analysis.department),
    priority: normalizePriority(analysis.priority),
    locationName: analysis.locationName || null,
  };
}

function buildMissingFields(draft = {}) {
  const missing = [];
  if (!draft.description) missing.push("description");
  if (!draft.department) missing.push("department");
  if (!draft.locationName) missing.push("locationName");
  return missing;
}

function getLanguageName(code) {
  return SUPPORTED_LANGUAGE_NAMES[code] || SUPPORTED_LANGUAGE_NAMES.en;
}

function heuristicLanguageDetection(text = "") {
  const value = String(text || "").trim();
  if (!value) return "en";

  if (/[\u0600-\u06FF]/.test(value)) return "ur";
  if (/[\u0A80-\u0AFF]/.test(value)) return "gu";
  if (/[\u0B80-\u0BFF]/.test(value)) return "ta";
  if (/[\u0C00-\u0C7F]/.test(value)) return "te";
  if (/[\u0980-\u09FF]/.test(value)) return "bn";
  if (/[\u0C80-\u0CFF]/.test(value)) return "kn";
  if (/[\u0D00-\u0D7F]/.test(value)) return "ml";
  if (/[\u0A00-\u0A7F]/.test(value)) return "pa";

  if (/[\u0900-\u097F]/.test(value)) {
    if (
      /\b(आहे|माझे|तुम्ही|काय|नाही)\b/i.test(value) ||
      /(का|करा|झाले|पाणी|रस्ता)/.test(value)
    ) {
      return "mr";
    }
    return "hi";
  }

  return "en";
}

async function detectLanguage(text = "") {
  const heuristic = heuristicLanguageDetection(text);
  if (!text || !genAI) {
    return { language: heuristic, source: "heuristic" };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Detect the language code of this text. Use only one code from this list:
en, hi, mr, gu, ta, te, bn, kn, ml, pa, ur.

Text: """${text}"""

Return ONLY JSON: {"language":"<code>"}`;
    const result = await model.generateContent(prompt);
    const raw = result.response
      .text()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(raw);
    const language = parsed?.language;
    if (SUPPORTED_LANGUAGE_NAMES[language]) {
      return { language, source: "model" };
    }
  } catch (_error) {
    // fallback below
  }

  return { language: heuristic, source: "heuristic" };
}

async function translateToLanguage(text, language) {
  if (!text || !language || language === "en" || !genAI) {
    return text;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Translate this text into ${getLanguageName(language)}.
Keep ticket IDs, numbers, and status labels unchanged.
Return only translated text.

Text: """${text}"""`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim() || text;
  } catch (_error) {
    return text;
  }
}

async function resolveLanguage(req, text = "") {
  let preferredLanguage = req.user?.preferredLanguage || "en";

  if (req.user?._id) {
    try {
      const user = await User.findById(req.user._id).select("preferredLanguage");
      if (user?.preferredLanguage) {
        preferredLanguage = user.preferredLanguage;
        req.user.preferredLanguage = user.preferredLanguage;
      }
    } catch (_error) {
      // noop
    }
  }

  const detected = await detectLanguage(text);
  const language = detected.language || preferredLanguage || "en";

  if (req.user?._id && language !== preferredLanguage) {
    try {
      await User.findByIdAndUpdate(req.user._id, { preferredLanguage: language });
      req.user.preferredLanguage = language;
    } catch (_error) {
      // noop
    }
  }

  return { language, detectedLanguage: detected.language, detectionSource: detected.source };
}

async function createComplaintFromDraft(req, draft) {
  const complaint = await Complaint.create({
    ticketId: generateTicketId(),
    userId: req.user._id,
    rawText: `${draft.title || "Complaint"}: ${draft.description}`,
    refinedText: draft.description,
    department: normalizeDepartment(draft.department),
    locationName: draft.locationName || "Location not provided",
    priority: normalizePriority(draft.priority),
    status: "pending",
    history: [
      {
        status: "pending",
        updatedBy: req.user._id,
        note: "Created from assistant",
      },
    ],
  });

  await notifyUser(req.user._id, {
    title: "Complaint Received",
    body: `Ticket ${complaint.ticketId} has been created.`,
    data: { type: "complaint_created", complaintId: String(complaint._id) },
  });

  return complaint;
}

function looksLikeComplaint(message = "") {
  const lower = message.toLowerCase();
  return (
    lower.includes("complaint") ||
    lower.includes("issue") ||
    lower.includes("problem") ||
    lower.includes("not working") ||
    lower.includes("broken") ||
    lower.includes("leak") ||
    lower.includes("garbage")
  );
}

// Chat endpoint for text-based conversation
router.post("/message", async (req, res) => {
  try {
    const { message, conversationHistory = [], action, draft } = req.body;
    const sourceText = action === "registerComplaint" ? draft?.description || "" : message;
    const languageMeta = await resolveLanguage(req, sourceText);
    const say = async (text) => translateToLanguage(text, languageMeta.language);

    if (!message && action !== "registerComplaint") {
      return res.status(400).json({ error: "Message is required" });
    }

    if (action === "registerComplaint") {
      if (!req.user?._id) {
        return res.status(401).json({
          error: "Authentication required to register complaint",
        });
      }

      const safeDraft = {
        title: draft?.title || "Complaint",
        description: draft?.description?.trim(),
        department: normalizeDepartment(draft?.department),
        priority: normalizePriority(draft?.priority),
        locationName: draft?.locationName?.trim() || null,
      };
      const missingFields = buildMissingFields(safeDraft);

      if (missingFields.length) {
        return res.status(200).json({
          response: await say(
            "I need a few more details before registering the complaint."
          ),
          assistant: {
            intent: "collect_details",
            canRegister: false,
            missingFields,
            draft: safeDraft,
          },
          language: languageMeta.language,
          detectedLanguage: languageMeta.detectedLanguage,
          timestamp: new Date().toISOString(),
        });
      }

      const complaint = await createComplaintFromDraft(req, safeDraft);
      return res.status(201).json({
        response: await say(
          `Complaint registered successfully. Your ticket ID is ${complaint.ticketId}.`
        ),
        assistant: {
          intent: "complaint_registered",
          canRegister: false,
          complaint: {
            id: complaint._id,
            ticketId: complaint.ticketId,
            status: complaint.status,
            department: complaint.department,
            priority: complaint.priority,
          },
        },
        language: languageMeta.language,
        detectedLanguage: languageMeta.detectedLanguage,
        timestamp: new Date().toISOString(),
      });
    }

    const analysis = await analyze(message);

    if (analysis?.type === "newComplaint") {
      const complaintDraft = buildDraftFromAnalysis(message, analysis);
      const missingFields = buildMissingFields(complaintDraft);
      const canRegister = req.user?._id && missingFields.length === 0;

      return res.status(200).json({
        response: await say(
          canRegister
            ? "I have drafted your complaint. Tap register to submit it."
            : "I have drafted your complaint. Please share missing details or log in to submit."
        ),
        assistant: {
          intent: "new_complaint",
          canRegister,
          missingFields,
          draft: complaintDraft,
        },
        language: languageMeta.language,
        detectedLanguage: languageMeta.detectedLanguage,
        timestamp: new Date().toISOString(),
      });
    }

    if (analysis?.error && looksLikeComplaint(message)) {
      const complaintDraft = buildDraftFromAnalysis(message, {
        refinedText: message,
        department: "other",
        priority: "Medium",
        locationName: null,
      });
      const missingFields = buildMissingFields(complaintDraft);
      return res.status(200).json({
        response: await say(
          "I detected a complaint. Please share missing details so I can register it."
        ),
        assistant: {
          intent: "new_complaint",
          canRegister: false,
          missingFields,
          draft: complaintDraft,
        },
        language: languageMeta.language,
        detectedLanguage: languageMeta.detectedLanguage,
        timestamp: new Date().toISOString(),
      });
    }

    if (analysis?.type === "statusQuery") {
      if (!req.user?._id && !analysis.complaintId) {
        return res.status(200).json({
          response: await say(
            "Please provide your ticket ID or log in to check latest complaint status."
          ),
          assistant: { intent: "status_query" },
          language: languageMeta.language,
          detectedLanguage: languageMeta.detectedLanguage,
          timestamp: new Date().toISOString(),
        });
      }

      let complaint = null;
      if (analysis.complaintId && analysis.complaintId !== "last") {
        complaint = await Complaint.findOne({ ticketId: analysis.complaintId });
      } else if (req.user?._id) {
        complaint = await Complaint.findOne({ userId: req.user._id }).sort({
          createdAt: -1,
        });
      }

      if (!complaint) {
        return res.status(200).json({
          response: await say("I could not find a complaint for that query."),
          assistant: { intent: "status_query", found: false },
          language: languageMeta.language,
          detectedLanguage: languageMeta.detectedLanguage,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        response: await say(
          `Ticket ${complaint.ticketId} is currently ${complaint.status}.`
        ),
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
        language: languageMeta.language,
        detectedLanguage: languageMeta.detectedLanguage,
        timestamp: new Date().toISOString(),
      });
    }

    // Use Gemini/general fallback response
    const response = await generateChatResponse(
      message,
      conversationHistory,
      languageMeta.language
    );

    res.json({
      response,
      assistant: { intent: "general" },
      language: languageMeta.language,
      detectedLanguage: languageMeta.detectedLanguage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// Speech-to-text endpoint
router.post("/speech-to-text", upload.single("audio"), async (req, res) => {
  try {
    console.log("Speech-to-text request received");
    console.log(
      "File:",
      req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : "No file"
    );

    if (!req.file) {
      console.log("No audio file provided");
      return res.status(400).json({ error: "No audio file provided" });
    }

    if (!genAI) {
      console.log("Gemini API not configured");
      return res
        .status(500)
        .json({
          error:
            "Speech recognition service not available - Gemini API key missing",
        });
    }

    console.log("Processing audio with Gemini...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert audio buffer to base64
    const base64Audio = req.file.buffer.toString("base64");
    console.log("Audio converted to base64, length:", base64Audio.length);

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Audio,
          mimeType: req.file.mimetype,
        },
      },
      "Please transcribe this audio file to text. Only return the transcribed text, nothing else.",
    ]);

    const transcription = result.response.text();
    const languageMeta = await resolveLanguage(req, transcription);
    console.log("Transcription successful:", transcription);

    res.json({
      text: transcription,
      language: languageMeta.language,
      detectedLanguage: languageMeta.detectedLanguage,
      detectionSource: languageMeta.detectionSource,
    });
  } catch (error) {
    console.error("Speech-to-text error:", error);
    res.status(500).json({
      error: "Failed to transcribe audio",
      details: error.message,
    });
  }
});

// Function to generate intelligent chat responses
async function generateChatResponse(
  message,
  conversationHistory = [],
  language = "en"
) {
  const lowerMessage = message.toLowerCase();

  // Check if this might be a complaint-related query
  if (
    lowerMessage.includes("complaint") ||
    lowerMessage.includes("problem") ||
    lowerMessage.includes("issue") ||
    lowerMessage.includes("report")
  ) {
    try {
      // Use the existing geminiService to analyze the message
      const analysis = await analyze(message);

      if (analysis.type === "newComplaint") {
        return translateToLanguage(
          `I understand you want to report: "${analysis.refinedText}". This appears to be a ${analysis.department} department issue with ${analysis.priority} priority. Would you like me to help you register this complaint? Please provide your location details if you'd like to proceed.`,
          language
        );
      } else if (analysis.type === "statusQuery") {
        return translateToLanguage(
          "I can help you check your complaint status. Please provide your complaint ID, or I can look up your most recent complaint if you're logged in.",
          language
        );
      }
    } catch (error) {
      console.error("Analysis error:", error);
    }
  }

  // Use Gemini for general conversation if available
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
      
      Respond in a conversational tone.
      Respond strictly in ${getLanguageName(language)} (${language}) language.`;

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Gemini chat error:", error);
    }
  }

  // Fallback responses
  if (
    lowerMessage.includes("hello") ||
    lowerMessage.includes("hi") ||
    lowerMessage.includes("hey")
  ) {
    return translateToLanguage(
      "Hello! I'm your municipal assistant. I can help you register complaints, check complaint status, or provide information about our services. How can I assist you today?",
      language
    );
  }

  if (lowerMessage.includes("help")) {
    return translateToLanguage(
      "I can assist you with:\n• Registering new complaints\n• Checking complaint status\n• Information about municipal services\n• Office hours and contact details\n• Service procedures\n\nWhat would you like to know more about?",
      language
    );
  }

  if (
    lowerMessage.includes("office hours") ||
    lowerMessage.includes("timing")
  ) {
    return translateToLanguage(
      "Our office hours are:\nMonday-Friday: 9:00 AM - 6:00 PM\nSaturday: 9:00 AM - 2:00 PM\nClosed on Sundays and public holidays.",
      language
    );
  }

  if (lowerMessage.includes("contact") || lowerMessage.includes("phone")) {
    return translateToLanguage(
      "You can reach us at:\n📞 1800-123-4567\n✉️ complaints@municipality.gov\n📍 Municipal Corporation Office, 123 Civic Center",
      language
    );
  }

  return translateToLanguage(
    "I understand you need assistance. I can help you register complaints, check status, or provide information about municipal services. Could you please be more specific about what you need help with?",
    language
  );
}

module.exports = router;
