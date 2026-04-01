const { analyze, genAI, sanitizeInput } = require("./geminiService");

const CHAT_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];
const HINDI_SCRIPT_REGEX = /[\u0900-\u097F]/;
const LANGUAGE_HINTS = {
  en: {
    complaintAuth:
      "Please log in first so I can register the complaint in your account.",
    complaintCreated:
      "Your complaint has been registered successfully.",
    complaintNeedLocation:
      "Please share the complaint location so I can register it.",
    complaintNeedCoordinates:
      "Please capture your current location so I can attach the required latitude and longitude.",
    complaintNeedImages:
      "Please add at least one proof image so I can register the complaint.",
    complaintNeedLocationAndImages:
      "Please capture your current location and add at least one proof image so I can register the complaint.",
    complaintNeedDetails:
      "Please tell me the issue and location, and I will register the complaint.",
    statusAuth:
      "Please log in first so I can check complaint status for you.",
    noComplaints: "I could not find any recent complaints for your account.",
    notFound: (ticketId) => `I could not find complaint ${ticketId}.`,
    forbidden:
      "You do not have permission to view this complaint.",
    recentHeader: "Here are your recent complaints:",
    statusLine: (ticketId, status) => `Complaint ${ticketId} is currently ${status}.`,
    generic:
      "I can help you register a complaint, check the latest complaint status, or find a complaint by ID.",
  },
  hi: {
    complaintAuth:
      "कृपया पहले लॉग इन करें, तभी मैं आपके खाते में शिकायत दर्ज कर पाऊंगा।",
    complaintCreated: "आपकी शिकायत सफलतापूर्वक दर्ज हो गई है।",
    complaintNeedLocation:
      "कृपया स्थान बताइए, ताकि मैं शिकायत दर्ज कर सकूं।",
    complaintNeedCoordinates:
      "कृपया अपनी वर्तमान लोकेशन कैप्चर करें, ताकि आवश्यक latitude और longitude जोड़ा जा सके।",
    complaintNeedImages:
      "कृपया कम से कम एक प्रूफ इमेज जोड़ें, तभी मैं शिकायत दर्ज कर सकूंगा।",
    complaintNeedLocationAndImages:
      "कृपया अपनी वर्तमान लोकेशन कैप्चर करें और कम से कम एक प्रूफ इमेज जोड़ें, तभी मैं शिकायत दर्ज कर सकूंगा।",
    complaintNeedDetails:
      "कृपया समस्या और स्थान बताइए, मैं शिकायत दर्ज कर दूंगा।",
    statusAuth:
      "कृपया पहले लॉग इन करें, तभी मैं शिकायत की स्थिति बता पाऊंगा।",
    noComplaints: "आपके खाते में हाल की कोई शिकायत नहीं मिली।",
    notFound: (ticketId) => `मुझे ${ticketId} शिकायत नहीं मिली।`,
    forbidden: "आपको यह शिकायत देखने की अनुमति नहीं है।",
    recentHeader: "ये आपकी हाल की शिकायतें हैं:",
    statusLine: (ticketId, status) => `${ticketId} शिकायत की स्थिति अभी ${status} है।`,
    generic:
      "मैं शिकायत दर्ज करने, हाल की शिकायत की स्थिति दिखाने, या आईडी से शिकायत खोजने में मदद कर सकता हूं।",
  },
};

function hasGeminiClient() {
  return Boolean(genAI);
}

function getLanguagePack(language = "en") {
  return LANGUAGE_HINTS[language] || LANGUAGE_HINTS.en;
}

function detectLanguage(message = "") {
  const value = String(message || "").trim();
  if (!value) return "en";
  if (HINDI_SCRIPT_REGEX.test(value)) return "hi";

  const lower = value.toLowerCase();
  if (
    lower.includes("meri") ||
    lower.includes("shikayat") ||
    lower.includes("kripya") ||
    lower.includes("nahi") ||
    lower.includes("status bata")
  ) {
    return "hi";
  }

  return "en";
}

function normalizePriority(value = "") {
  const lower = String(value || "").trim().toLowerCase();
  if (lower === "high") return "High";
  if (lower === "low") return "Low";
  return "Medium";
}

function extractLocationFromText(message = "") {
  const value = String(message || "").trim();
  const match = value.match(
    /\b(?:at|near|in|behind|beside|opposite|around)\s+([a-z0-9 ,.-]{3,80})/i,
  );
  return match ? match[1].trim() : null;
}

function extractComplaintDescription(message = "") {
  return String(message || "")
    .replace(/\b(register|raise|file|lodge|check|show|track)\b/gi, "")
    .replace(/\b(complaint|issue|problem|status)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildComplaintTitle(description = "", department = "") {
  const source = String(description || "").trim();
  if (!source) return `${department || "General"} complaint`;
  const compact = source.split(/[.!?]/)[0].trim();
  return compact.length > 80 ? `${compact.slice(0, 77).trim()}...` : compact;
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
  if (!genAI) {
    throw new Error("Gemini API key not configured");
  }
  let lastError = null;
  for (const modelName of CHAT_MODELS) {
    try {
      return await generateWithModel(modelName, prompt, inlineAudio);
    } catch (error) {
      lastError = error;
      console.error(
        `Gemini model ${modelName} failed:`,
        error?.message || error,
      );
    }
  }
  throw lastError || new Error("No Gemini model available");
}

function extractJsonObject(text = "") {
  const value = String(text || "").trim();
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return value.slice(start, end + 1);
}

function inferIntentHeuristically(message = "", detectedLanguage = "en") {
  const lower = String(message || "").toLowerCase();
  const ticketMatch = String(message || "").match(/\b[A-Z]{2,5}\d{3,8}\b/i);
  const ticketId = ticketMatch ? ticketMatch[0].toUpperCase() : null;

  const wantsRecent =
    lower.includes("recent complaint") ||
    lower.includes("last complaint") ||
    lower.includes("my complaints") ||
    lower.includes("meri complaint") ||
    lower.includes("meri shikayat") ||
    lower.includes("recent status");

  const wantsStatus =
    lower.includes("status") ||
    lower.includes("track") ||
    lower.includes("show complaint") ||
    lower.includes("find complaint");

  const wantsRegister =
    lower.includes("register complaint") ||
    lower.includes("new complaint") ||
    lower.includes("report") ||
    lower.includes("problem") ||
    lower.includes("issue") ||
    lower.includes("shikayat") ||
    lower.includes("complaint");

  const description = extractComplaintDescription(message);
  const locationName = extractLocationFromText(message);
  const missingFields = [];
  if (wantsRegister && !description) missingFields.push("description");
  if (wantsRegister && !locationName) missingFields.push("locationName");

  if (ticketId) {
    return {
      language: detectedLanguage,
      intent: "complaint_status",
      ticketId,
      complaintDraft: null,
      missingFields: [],
      shouldCreateComplaint: false,
    };
  }

  if (wantsRecent && !ticketId) {
    return {
      language: detectedLanguage,
      intent: "recent_complaints",
      ticketId: null,
      complaintDraft: null,
      missingFields: [],
      shouldCreateComplaint: false,
    };
  }

  if (wantsStatus) {
    return {
      language: detectedLanguage,
      intent: "complaint_status",
      ticketId: null,
      complaintDraft: null,
      missingFields: ["ticketId"],
      shouldCreateComplaint: false,
    };
  }

  if (wantsRegister) {
    return {
      language: detectedLanguage,
      intent: "register_complaint",
      ticketId: null,
      complaintDraft: {
        title: buildComplaintTitle(description),
        description,
        department: "Other",
        priority: "Medium",
        locationName,
      },
      missingFields,
      shouldCreateComplaint: missingFields.length === 0,
    };
  }

  return {
    language: detectedLanguage,
    intent: "general",
    ticketId: null,
    complaintDraft: null,
    missingFields: [],
    shouldCreateComplaint: false,
  };
}

async function analyzeAssistantRequest(
  message,
  conversationHistory = [],
  departmentNames = [],
) {
  const detectedLanguage = detectLanguage(message);

  if (genAI) {
    try {
      const safeMessage = sanitizeInput(message, 700);
      const history = conversationHistory
        .slice(-8)
        .map(
          (item) =>
            `${item.role || "user"}: ${sanitizeInput(String(item.text || item.content || ""), 300)}`,
        )
        .join("\n");

      const prompt = `
You are a municipal complaint assistant. Read the user message and return JSON only.

Supported intents:
- "register_complaint"
- "recent_complaints"
- "complaint_status"
- "general"

Available department names: ${departmentNames.join(", ")}

Rules:
1. Detect the user's primary language and return ISO-like code in "language". Use "hi" for Hindi and "en" for English when unsure.
2. If the user wants to register a complaint and enough details are present, set "shouldCreateComplaint" to true.
3. For complaint registration, extract:
   - title
   - description
   - department
   - priority ("Low" | "Medium" | "High")
   - locationName
4. For status checks, extract "ticketId" if present. If the user asks for the latest/recent complaint, use intent "recent_complaints".
5. If key registration details are missing, list them in "missingFields". Use only: "description", "locationName".
6. Never invent a ticket ID.
7. "generalResponse" should be a short helpful reply in the same language as the user.

Conversation history:
${history || "none"}

User message:
"""${safeMessage}"""

Return exactly this shape:
{
  "language": "en",
  "intent": "general",
  "ticketId": null,
  "shouldCreateComplaint": false,
  "missingFields": [],
  "complaintDraft": {
    "title": null,
    "description": null,
    "department": null,
    "priority": "Medium",
    "locationName": null
  },
  "generalResponse": ""
}
`;

      const raw = await runGeminiWithFallback(prompt);
      const jsonCandidate = extractJsonObject(raw);
      if (jsonCandidate) {
        const parsed = JSON.parse(jsonCandidate);
        return {
          language: parsed.language || detectedLanguage,
          intent: parsed.intent || "general",
          ticketId: parsed.ticketId
            ? String(parsed.ticketId).trim().toUpperCase()
            : null,
          shouldCreateComplaint: Boolean(parsed.shouldCreateComplaint),
          missingFields: Array.isArray(parsed.missingFields)
            ? parsed.missingFields.filter(Boolean)
            : [],
          complaintDraft: parsed.complaintDraft
            ? {
                title: parsed.complaintDraft.title
                  ? String(parsed.complaintDraft.title).trim()
                  : null,
                description: parsed.complaintDraft.description
                  ? String(parsed.complaintDraft.description).trim()
                  : null,
                department: parsed.complaintDraft.department
                  ? String(parsed.complaintDraft.department).trim()
                  : null,
                priority: normalizePriority(parsed.complaintDraft.priority),
                locationName: parsed.complaintDraft.locationName
                  ? String(parsed.complaintDraft.locationName).trim()
                  : null,
              }
            : null,
          generalResponse: String(parsed.generalResponse || "").trim(),
        };
      }
    } catch (error) {
      console.error("Assistant intent analysis failed:", error);
    }
  }

  return inferIntentHeuristically(message, detectedLanguage);
}

async function generateChatResponse(
  message,
  conversationHistory = [],
  language = detectLanguage(message),
) {
  const lowerMessage = String(message || "").toLowerCase();
  const copy = getLanguagePack(language);

  if (
    lowerMessage.includes("complaint") ||
    lowerMessage.includes("problem") ||
    lowerMessage.includes("issue") ||
    lowerMessage.includes("report") ||
    lowerMessage.includes("shikayat")
  ) {
    try {
      const analysis = await analyze(message);

      if (analysis.type === "newComplaint") {
        if (language === "hi") {
          return `मैं आपकी शिकायत दर्ज करने में मदद कर सकता हूं। समस्या "${analysis.refinedText}" लग रही है। कृपया स्थान बताइए, मैं आगे बढ़ता हूं।`;
        }
        return `I can help register this complaint. It looks like "${analysis.refinedText}". Please share the location and I will proceed.`;
      }

      if (analysis.type === "statusQuery") {
        return language === "hi"
          ? "मैं शिकायत की स्थिति बता सकता हूं। शिकायत आईडी भेजें या हाल की शिकायत पूछें।"
          : "I can check complaint status. Share the complaint ID or ask for your recent complaint.";
      }
    } catch (error) {
      console.error("Analysis error:", error);
    }
  }

  if (genAI) {
    try {
      const safeMessage = sanitizeInput(message, 500);
      const context =
        conversationHistory.length > 0
          ? `Previous conversation:\n${conversationHistory
              .map(
                (msg) =>
                  `${msg.role || "user"}: ${sanitizeInput(String(msg.text ?? msg.content ?? ""), 500)}`,
              )
              .join("\n")}\n\n`
          : "";

      const prompt = `${context}You are a helpful municipal assistant chatbot. The user is interacting with a municipal complaints system.

Respond helpfully to their query: "${safeMessage}"

Keep responses concise, friendly, and relevant to municipal services. If they ask about complaints, guide them to register or check status.
Respond in ${language === "hi" ? "Hindi" : "English"}.
`;

      return await runGeminiWithFallback(prompt);
    } catch (error) {
      console.error("Gemini chat error:", error);
    }
  }

  if (
    lowerMessage.includes("hello") ||
    lowerMessage.includes("hi") ||
    lowerMessage.includes("hey")
  ) {
    return language === "hi"
      ? "नमस्ते, मैं आपका नगर सहायक हूं। मैं शिकायत दर्ज करने, स्थिति देखने और शिकायत आईडी खोजने में मदद कर सकता हूं।"
      : "Hello! I can help register complaints, check complaint status, and find complaints by ID.";
  }

  if (lowerMessage.includes("help")) {
    return copy.generic;
  }

  return copy.generic;
}

module.exports = {
  hasGeminiClient,
  runGeminiWithFallback,
  generateChatResponse,
  analyzeAssistantRequest,
  detectLanguage,
  getLanguagePack,
  buildComplaintTitle,
};
