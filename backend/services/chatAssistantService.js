const { analyze, genAI, sanitizeInput } = require("./geminiService");

const CHAT_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];
const HINDI_SCRIPT_REGEX = /[\u0900-\u097F]/;
const LANGUAGE_HINT_KEYS = [
  "complaintAuth",
  "complaintCreated",
  "complaintNeedLocation",
  "complaintNeedCoordinates",
  "complaintNeedImages",
  "complaintNeedLocationAndImages",
  "complaintNeedDetails",
  "statusAuth",
  "noComplaints",
  "notFound",
  "forbidden",
  "recentHeader",
  "statusLine",
  "generic",
];
const LANGUAGE_HINT_STRINGS = {
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
    notFound: "I could not find complaint %{ticketId}.",
    forbidden:
      "You do not have permission to view this complaint.",
    recentHeader: "Here are your recent complaints:",
    statusLine: "Complaint %{ticketId} is currently %{status}.",
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
    notFound: "मुझे %{ticketId} शिकायत नहीं मिली।",
    forbidden: "आपको यह शिकायत देखने की अनुमति नहीं है।",
    recentHeader: "ये आपकी हाल की शिकायतें हैं:",
    statusLine: "%{ticketId} शिकायत की स्थिति अभी %{status} है।",
    generic:
      "मैं शिकायत दर्ज करने, हाल की शिकायत की स्थिति दिखाने, या आईडी से शिकायत खोजने में मदद कर सकता हूं।",
  },
};
const localizedLanguagePackCache = new Map();

const ROMANIZED_HINDI_HINTS = [
  "mujhe",
  "mujh",
  "meri",
  "mera",
  "mere",
  "shikayat",
  "kripya",
  "kripiya",
  "nahi",
  "hai",
  "karni",
  "karna",
  "kar do",
  "madad",
  "mandir",
  "paas",
  "gadde",
  "sadak",
  "road pe",
  "colony",
  "gali",
];

const LOCATION_SEGMENT_REGEX =
  /\b(?:location(?:\s+is|\s+h|\s+hai)?|loc(?:ation)?|address(?:\s+is)?|at|in|near|around|behind|beside|opposite)\b[\s:,-]*([^.!?\n]{3,120})/i;
const HINDI_LOCATION_SEGMENT_REGEX =
  /(?:लोकेशन|स्थान|पता)\s*(?:है|:)?\s*([^.!?\n]{3,120})/i;
const LOCATION_KEYWORD_REGEX =
  /\b(colony|nagar|road|street|sector|block|area|gali|mandir|chowk|bridge|market|hospital|school|park)\b/i;
const HINDI_LOCATION_KEYWORD_REGEX =
  /(कॉलोनी|नगर|रोड|सड़क|गली|चौराहा|मंदिर|पार्क|मार्केट|हॉस्पिटल|स्कूल)/;
const ATTACHMENT_HELPER_PREFIX_REGEX =
  /^(use these location coordinates(?: and proof images)? to continue registering my complaint\.?|use these proof images to continue registering my complaint\.?|मेरी शिकायत दर्ज करने के लिए ये लोकेशन निर्देशांक(?: और प्रूफ इमेज)? हैं।?|मेरी शिकायत दर्ज करने के लिए ये प्रूफ इमेज हैं।?)/i;
const ATTACHMENT_TRAILER_REGEX =
  /(\b\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\b|\b\d+\s+proof image(?:s)? attached\b|\b\d+\s+प्रूफ इमेज जोड़ी गई\b)/gi;

const DEPARTMENT_KEYWORDS = [
  {
    department: "Electricity",
    patterns: [
      /\bstreet\s*light\b/i,
      /\bstreetlight\b/i,
      /\blight\s+gay[ai]\b/i,
      /\blight\s+tut/i,
      /\bbulb\b/i,
      /\bpole\b/i,
      /\bsparking\b/i,
      /\blight\b/i,
      /\belectric/i,
      /\btransformer\b/i,
      /\bmeter\b/i,
      /\bwire\b/i,
      /\bpower\b/i,
      /स्ट्रीट\s*लाइट/,
      /बिजली/,
      /मीटर/,
      /ट्रांसफॉर्मर/,
    ],
  },
  {
    department: "Water",
    patterns: [
      /\bwater\b/i,
      /\bpipe\b/i,
      /\bleak/i,
      /\bleakage\b/i,
      /\btap\b/i,
      /\bno\s+water\b/i,
      /\bsupply\b/i,
      /\bborewell\b/i,
      /\btanker\b/i,
      /पानी/,
      /लीकेज/,
      /लीक/,
      /बोरवेल/,
      /टैंकर/,
    ],
  },
  {
    department: "Drainage",
    patterns: [
      /\bdrain/i,
      /\bsewer/i,
      /\bsewage/i,
      /\bdrainage\b/i,
      /\bblocked\s+drain\b/i,
      /\bmanhole\b/i,
      /\bnala\b/i,
      /नाली/,
      /सीवर/,
      /ड्रेनेज/,
      /गटर/,
    ],
  },
  {
    department: "Waste",
    patterns: [
      /\bgarbage\b/i,
      /\bwaste\b/i,
      /\bdustbin\b/i,
      /\btrash\b/i,
      /\blitter\b/i,
      /\brubbish\b/i,
      /\boverflowing\s+bin\b/i,
      /कचरा/,
      /कूड़ा/,
      /डस्टबिन/,
      /वेस्ट/,
    ],
  },
  {
    department: "Road",
    patterns: [
      /\bpothole\b/i,
      /\broad\b/i,
      /\bstreet\b/i,
      /\bpavement\b/i,
      /\bdivider\b/i,
      /\bbroken\s+road\b/i,
      /\broad\s+broken\b/i,
      /\bgadd[ea]\b/i,
      /\bgadde\b/i,
      /\bkhadd[ea]\b/i,
      /\bpit\b/i,
      /गड्ढ/,
      /सड़क/,
      /रोड/,
    ],
  },
];

function hasGeminiClient() {
  return Boolean(genAI);
}

function normalizeLanguageCode(language = "en") {
  const value = String(language || "").trim().toLowerCase();
  if (!value) return "en";

  if (value === "english") return "en";
  if (value === "hindi") return "hi";

  return value.split(/[-_]/)[0] || "en";
}

function interpolateTemplate(template = "", values = {}) {
  return String(template || "").replace(/%\{(\w+)\}/g, (_match, key) =>
    values[key] === undefined || values[key] === null ? "" : String(values[key]),
  );
}

function buildLanguagePack(strings = LANGUAGE_HINT_STRINGS.en) {
  return {
    ...strings,
    notFound: (ticketId) =>
      interpolateTemplate(strings.notFound, { ticketId }),
    statusLine: (ticketId, status) =>
      interpolateTemplate(strings.statusLine, { ticketId, status }),
  };
}

async function getLanguagePack(language = "en") {
  const normalized = normalizeLanguageCode(language);
  if (normalized === "en" || !genAI) {
    return buildLanguagePack(LANGUAGE_HINT_STRINGS.en);
  }
  if (normalized === "hi") {
    return buildLanguagePack(LANGUAGE_HINT_STRINGS.hi);
  }
  if (localizedLanguagePackCache.has(normalized)) {
    return localizedLanguagePackCache.get(normalized);
  }

  try {
    const prompt = `
Translate the following municipal-assistant response templates into the target language.

Target language code: ${normalized}

Rules:
1. Return valid JSON only.
2. Preserve keys exactly.
3. Preserve placeholders exactly, including %{ticketId} and %{status}.
4. Keep the meaning concise and natural for end users.

Templates:
${JSON.stringify(LANGUAGE_HINT_STRINGS.en, null, 2)}
`;

    const raw = await runGeminiWithFallback(prompt);
    const jsonCandidate = extractJsonObject(raw);
    if (jsonCandidate) {
      const parsed = JSON.parse(jsonCandidate);
      const translated = LANGUAGE_HINT_KEYS.reduce((acc, key) => {
        acc[key] = String(parsed?.[key] || LANGUAGE_HINT_STRINGS.en[key]).trim();
        return acc;
      }, {});
      const pack = buildLanguagePack(translated);
      localizedLanguagePackCache.set(normalized, pack);
      return pack;
    }
  } catch (error) {
    console.error("Language pack localization failed:", error?.message || error);
  }

  return buildLanguagePack(LANGUAGE_HINT_STRINGS.en);
}

async function detectLanguageWithModel(message = "") {
  const fallback = detectLanguage(message);
  const value = String(message || "").trim();
  if (!value || !genAI) return fallback;

  try {
    const prompt = `
Detect the primary language of this text and return JSON only.

Text:
"""${sanitizeInput(value, 500)}"""

Rules:
1. Return a short ISO 639-1 code when possible, such as en, hi, mr, gu, ta, te, bn, pa, ur, ar, fr, es.
2. If the text is romanized Hindi, return "hi".
3. If unsure, return "en".

Return exactly:
{"language":"en"}
`;
    const raw = await runGeminiWithFallback(prompt);
    const jsonCandidate = extractJsonObject(raw);
    if (jsonCandidate) {
      const parsed = JSON.parse(jsonCandidate);
      return normalizeLanguageCode(parsed?.language || fallback);
    }
  } catch (error) {
    console.error("Language detection failed:", error?.message || error);
  }

  return fallback;
}

function detectLanguage(message = "") {
  const value = String(message || "").trim();
  if (!value) return "en";
  if (HINDI_SCRIPT_REGEX.test(value)) return "hi";

  const lower = value.toLowerCase();
  if (ROMANIZED_HINDI_HINTS.some((hint) => lower.includes(hint))) {
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
  if (!value) return null;

  const explicitEnglish = value.match(LOCATION_SEGMENT_REGEX);
  if (explicitEnglish?.[1]) {
    return explicitEnglish[1].trim();
  }

  const explicitHindi = value.match(HINDI_LOCATION_SEGMENT_REGEX);
  if (explicitHindi?.[1]) {
    return explicitHindi[1].trim();
  }

  const englishMatch = value.match(
    /\b(?:at|near|in|behind|beside|opposite|around)\s+([a-z0-9 ,.'-]{3,100})/i,
  );
  if (englishMatch?.[1]) {
    return englishMatch[1].trim();
  }

  const hindiMatch = value.match(
    /(?:के\s+पास|के\s+सामने|में|के\s+निकट)\s+([^.!?\n]{3,100})/i,
  );
  if (hindiMatch?.[1] && (LOCATION_KEYWORD_REGEX.test(hindiMatch[1]) || HINDI_LOCATION_KEYWORD_REGEX.test(hindiMatch[1]))) {
    return hindiMatch[1].trim();
  }

  const tailWithKeyword = value
    .split(/[,.\n]/)
    .map((segment) => segment.trim())
    .find(
      (segment) =>
        LOCATION_KEYWORD_REGEX.test(segment) ||
        HINDI_LOCATION_KEYWORD_REGEX.test(segment),
    );

  return tailWithKeyword || null;
}

function extractComplaintDescription(message = "") {
  return String(message || "")
    .replace(ATTACHMENT_HELPER_PREFIX_REGEX, " ")
    .replace(ATTACHMENT_TRAILER_REGEX, " ")
    .replace(
      /(?:लोकेशन|स्थान|पता|location|address)\s*(?:is|h|hai|है|:)?\s*[^.!?\n]+/gi,
      " ",
    )
    .replace(
      /\b(mujhe|mujhko|meri|mere|mera|please|pls|plz|kripya|please\s+fix|fix\s+it|register|complaint|krni|karni|karna|krdo|kar do|jaldi se|issue hai|problem hai)\b/gi,
      " ",
    )
    .replace(
      /(मुझे|मेरी|मेरा|मेरे|कृपया|शिकायत|दर्ज|करनी|करना|कर दो|जल्दी|ठीक करें)/g,
      " ",
    )
    .replace(/\b(register|raise|file|lodge|check|show|track)\b/gi, "")
    .replace(/\b(complaint|issue|problem|status)\b/gi, "")
    .replace(/\b(h|hai)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComplaintDescription(description = "") {
  return extractComplaintDescription(description)
    .replace(/^(mere\s+ghr\s+ke\s+saamne)\b/i, "in front of my house")
    .replace(/^(mere\s+ghar\s+ke\s+saamne)\b/i, "in front of my house")
    .replace(/^(mere\s+ghr\s+samne)\b/i, "in front of my house")
    .replace(/^(mere\s+house\s+ke\s+samne)\b/i, "in front of my house")
    .replace(/\b(tut\s+gayi|tut\s+gyi|tut\s+gai)\b/gi, "broken")
    .replace(/\blight\s+gay[ai]\b/gi, "light not working")
    .replace(/\b(gadde|gadda|khadda|khadde)\b/gi, "potholes")
    .replace(/\s+/g, " ")
    .trim();
}

function inferDepartmentFromDescription(description = "") {
  const value = String(description || "").trim();
  if (!value) return "Other";

  const matched = DEPARTMENT_KEYWORDS.find(({ patterns }) =>
    patterns.some((pattern) => pattern.test(value)),
  );

  return matched?.department || "Other";
}

function hasComplaintSignal(message = "") {
  const lower = String(message || "").toLowerCase();
  if (!lower) return false;

  return (
    inferDepartmentFromDescription(lower) !== "Other" ||
    /\b(report|register|complaint|issue|problem|help|urgent|danger|broken|not working|leak|overflow|garbage|street light|pothole|road|water|drain|waste)\b/i.test(
      lower,
    ) ||
    /(शिकायत|समस्या|मदद|खराब|टूटी|गड्ढ|कचरा|पानी|नाली|बिजली|रोड|सड़क)/.test(lower)
  );
}

function normalizeAssistantHistoryText(message = "", generatedContinuation = false) {
  const value = String(message || "").trim();
  if (!value) return "";
  if (generatedContinuation) return "";

  return value
    .replace(ATTACHMENT_HELPER_PREFIX_REGEX, " ")
    .replace(ATTACHMENT_TRAILER_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildComplaintTitle(description = "", department = "") {
  const source = String(description || "").trim();
  if (!source) return `${department || "General"} complaint`;

  if (/\bstreet\s*light\b|\bstreetlight\b|स्ट्रीट\s*लाइट/i.test(source)) {
    if (/\b(broken|not working|fused|damaged|dead|tut|gay[ai])\b|टूटी|खराब|बंद/i.test(source)) {
      return "Broken street light";
    }
    return "Street light issue";
  }

  if (/\bpothole\b|\bgadd[ea]\b|\bgadde\b|\bkhadd[ea]\b|गड्ढ/i.test(source)) {
    return "Pothole on road";
  }

  if (/\bgarbage\b|\bwaste\b|कचरा/i.test(source)) {
    return "Garbage collection issue";
  }

  if (/\bwater\b|\bleak\b|पानी|लीकेज/i.test(source)) {
    return "Water supply issue";
  }

  if (/\bdrain\b|\bsewer\b|नाली|सीवर/i.test(source)) {
    return "Drainage issue";
  }

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
    lower.includes("complaint") ||
    lower.includes("light") ||
    lower.includes("street light") ||
    lower.includes("pothole") ||
    lower.includes("gadde") ||
    lower.includes("broken") ||
    lower.includes("toot") ||
    lower.includes("kharab") ||
    hasComplaintSignal(message);

  const description = extractComplaintDescription(message);
  const normalizedDescription = normalizeComplaintDescription(description);
  const locationName = extractLocationFromText(message);
  const missingFields = [];
  if (wantsRegister && !normalizedDescription) missingFields.push("description");
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
    const inferredDepartment = inferDepartmentFromDescription(normalizedDescription);
    return {
      language: detectedLanguage,
      intent: "register_complaint",
      ticketId: null,
        complaintDraft: {
        title: buildComplaintTitle(normalizedDescription),
        description: normalizedDescription,
        department: inferDepartmentFromDescription(normalizedDescription),
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
  const detectedLanguage = await detectLanguageWithModel(message);
  const recentConversationLanguage = [...conversationHistory]
    .reverse()
    .map((item) =>
      item?.assistant?.language || detectLanguage(String(item?.text || item?.content || "")),
    )
    .find(Boolean);
  const preferredLanguage =
    detectedLanguage !== "en" ? detectedLanguage : recentConversationLanguage || detectedLanguage;

  if (genAI) {
    try {
      const safeMessage = sanitizeInput(message, 700);
      const history = conversationHistory
        .slice(-8)
        .map(
          (item) =>
            `${item.role || "user"}: ${sanitizeInput(
              normalizeAssistantHistoryText(
                String(item.text || item.content || ""),
                Boolean(item.generatedContinuation),
              ),
              300,
            )}`,
        )
        .filter((line) => !/(^user:\s*$|^assistant:\s*$)/i.test(line))
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
1. Detect the user's primary language and return a short language code in "language". Use codes like "en", "hi", "mr", "gu", "ta", "te", "bn", "pa", "ur", "ar", "fr", "es" when possible.
2. If the text is romanized Hindi, return "hi".
3. If the user wants to register a complaint and enough details are present, set "shouldCreateComplaint" to true.
4. For complaint registration, extract:
   - title
   - description
   - department
   - priority ("Low" | "Medium" | "High")
   - locationName
5. For status checks, extract "ticketId" if present. If the user asks for the latest/recent complaint, use intent "recent_complaints".
6. If key registration details are missing, list them in "missingFields". Use only: "description", "locationName".
7. Never invent a ticket ID.
8. "generalResponse" should be a short helpful reply in the same language as the user.

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
        const parsedComplaintDraft =
          parsed?.complaintDraft && typeof parsed.complaintDraft === "object"
            ? parsed.complaintDraft
            : {};
        const heuristicDescription = normalizeComplaintDescription(message);
        const heuristicLocation = extractLocationFromText(message);
        const heuristicWantsRegister = inferIntentHeuristically(
          message,
          preferredLanguage,
        );
        const rawMissingFields = Array.isArray(parsed.missingFields)
          ? parsed.missingFields.filter(Boolean)
          : [];
        const mergedDescription = parsed?.complaintDraft?.description
          ? normalizeComplaintDescription(parsed.complaintDraft.description)
          : heuristicDescription || null;
        const mergedLocationName = parsed?.complaintDraft?.locationName
          ? String(parsed.complaintDraft.locationName).trim()
          : heuristicLocation || null;
        const heuristicDepartment = inferDepartmentFromDescription(
          mergedDescription,
        );
        const parsedDepartment = parsedComplaintDraft.department
          ? String(parsedComplaintDraft.department).trim()
          : "";
        const mergedDepartment =
          parsedDepartment && parsedDepartment !== "Other"
            ? parsedDepartment
            : heuristicDepartment;
        const mergedIntent =
          parsed.intent === "general" &&
          heuristicWantsRegister.intent === "register_complaint"
            ? "register_complaint"
            : parsed.intent || "general";
        const normalizedMissingFields = rawMissingFields.filter((field) => {
          if (field === "description" && mergedDescription) return false;
          if (field === "locationName" && mergedLocationName) return false;
          return true;
        });

        return {
          language: normalizeLanguageCode(
            preferredLanguage !== "en"
              ? preferredLanguage
              : parsed.language || preferredLanguage,
          ),
          intent: mergedIntent,
          ticketId: parsed.ticketId
            ? String(parsed.ticketId).trim().toUpperCase()
            : null,
          shouldCreateComplaint:
            Boolean(parsed.shouldCreateComplaint) ||
            (mergedIntent === "register_complaint" &&
              Boolean(mergedDescription) &&
              Boolean(mergedLocationName)),
          missingFields: normalizedMissingFields,
          complaintDraft: parsed.complaintDraft || heuristicWantsRegister.complaintDraft
            ? {
                title: parsedComplaintDraft.title
                  ? String(parsedComplaintDraft.title).trim()
                  : buildComplaintTitle(
                      mergedDescription,
                      mergedDepartment,
                    ),
                description: mergedDescription,
                department: mergedDepartment,
                priority: normalizePriority(parsedComplaintDraft.priority),
                locationName: mergedLocationName,
              }
            : null,
          generalResponse: String(parsed.generalResponse || "").trim(),
        };
      }
    } catch (error) {
      console.error("Assistant intent analysis failed:", error);
    }
  }

  return inferIntentHeuristically(message, preferredLanguage);
}

async function generateChatResponse(
  message,
  conversationHistory = [],
  language = detectLanguage(message),
) {
  const lowerMessage = String(message || "").toLowerCase();
  const copy = await getLanguagePack(language);

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
  detectLanguageWithModel,
  getLanguagePack,
  buildComplaintTitle,
};
