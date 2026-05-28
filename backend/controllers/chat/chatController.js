const Complaint = require("../../models/Complaint");
const { buildComplaintView } = require("../../utils/complaintView");
const {
  hasGeminiClient,
  runGeminiWithFallback,
  generateChatResponse,
  analyzeAssistantRequest,
  detectLanguage,
  detectLanguageWithModel,
  getLanguagePack,
  buildComplaintTitle,
} = require("../../services/chatAssistantService");
const {
  extractTicketId,
  findComplaintByTicketId,
  findRecentComplaintsForUser,
  canUserAccessComplaint,
} = require("../../services/complaintLookupService");
const { getDepartmentNames } = require("../../services/departmentService");
const { sendComplaintRegistered } = require("../../services/emailService");
const {
  parseCoordinates,
  uploadComplaintImages,
} = require("../../services/complaintService");

function parseConversationHistory(rawConversationHistory) {
  if (Array.isArray(rawConversationHistory)) {
    return rawConversationHistory;
  }

  if (typeof rawConversationHistory === "string") {
    try {
      const parsed = JSON.parse(rawConversationHistory);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  return [];
}

function createAssistantResponse(response, assistant = {}) {
  return {
    response,
    assistant,
    timestamp: new Date().toISOString(),
  };
}

function getPendingRegistrationContext(conversationHistory = []) {
  const history = Array.isArray(conversationHistory) ? conversationHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (
      entry?.role === "assistant" &&
      entry?.assistant?.intent === "register_complaint" &&
      entry?.assistant?.created !== true
    ) {
      return {
        assistantMeta: entry.assistant || {},
      };
    }
  }

  return null;
}

function getLatestAttachmentState(conversationHistory = []) {
  const history = Array.isArray(conversationHistory) ? conversationHistory : [];
  let latestCoordinates = null;
  let latestImages = [];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    const attachments = entry?.attachments || {};

    if (!latestCoordinates && attachments.coordinates) {
      latestCoordinates = parseCoordinates(attachments.coordinates);
    }

    if (
      latestImages.length === 0 &&
      Array.isArray(attachments.images) &&
      attachments.images.length > 0
    ) {
      latestImages = attachments.images
        .map((image) => String(image || "").trim())
        .filter(Boolean);
    }

    if (latestCoordinates && latestImages.length > 0) {
      break;
    }
  }

  return {
    coordinates: latestCoordinates,
    images: latestImages,
  };
}

function uniqueImageUrls(images = []) {
  return [...new Set(
    (Array.isArray(images) ? images : [])
      .map((image) => String(image || "").trim())
      .filter(Boolean),
  )];
}

function looksLikeStandaloneLocationMessage(message = "") {
  const value = String(message || "").trim();
  if (!value) return false;

  if (value.length > 140) return false;

  const lower = value.toLowerCase();
  if (
    /\b(exponentpushtoken|rd\d+|cmp-[a-z0-9-]+)\b/i.test(value) ||
    lower.includes("status") ||
    lower.includes("complaint id")
  ) {
    return false;
  }

  return (
    /[,/-]/.test(value) ||
    /\b(colony|nagar|mandir|road|street|sector|block|area|gali|near|paas|ke paas|opposite|behind|beside)\b/i.test(
      value,
    )
  );
}

function removeMissingField(missingFields = [], field) {
  const index = missingFields.indexOf(field);
  if (index >= 0) missingFields.splice(index, 1);
}

function uniqueMissingFields(fields = []) {
  return [...new Set((Array.isArray(fields) ? fields : []).filter(Boolean))];
}

function computeRegistrationMissingFields({
  description,
  locationName,
  coordinates,
  collectedImages,
}) {
  const missingFields = [];

  if (!String(description || "").trim()) {
    missingFields.push("description");
  }

  if (!String(locationName || "").trim()) {
    missingFields.push("locationName");
  }

  if (!coordinates) {
    missingFields.push("coordinates");
  }

  if (!Array.isArray(collectedImages) || collectedImages.length === 0) {
    missingFields.push("images");
  }

  return missingFields;
}

function buildRegistrationFollowUpResponse(copy, language, missingFields = []) {
  const fields = uniqueMissingFields(missingFields);

  const hasDescription = fields.includes("description");
  const hasLocationName = fields.includes("locationName");
  const hasCoordinates = fields.includes("coordinates");
  const hasImages = fields.includes("images");

  if (hasDescription && hasLocationName && hasCoordinates && hasImages) {
    return language === "hi"
      ? "कृपया समस्या स्पष्ट बताइए, किसी पहचानने योग्य स्थान या कॉलोनी का नाम बताइए, अपनी वर्तमान लोकेशन कैप्चर करें, और कम से कम एक प्रूफ इमेज जोड़ें, तभी मैं शिकायत दर्ज कर सकूंगा।"
      : "Please describe the issue clearly, share a landmark or location name, capture your current location, and add at least one proof image so I can register the complaint.";
  }

  if (hasDescription && hasCoordinates && hasImages) {
    return language === "hi"
      ? "कृपया समस्या स्पष्ट बताइए, अपनी वर्तमान लोकेशन कैप्चर करें, और कम से कम एक प्रूफ इमेज जोड़ें, तभी मैं शिकायत दर्ज कर सकूंगा।"
      : "Please describe the issue clearly, capture your current location, and add at least one proof image so I can register the complaint.";
  }

  if (hasDescription && hasLocationName && hasCoordinates) {
    return language === "hi"
      ? "कृपया समस्या स्पष्ट बताइए, किसी पहचानने योग्य स्थान या कॉलोनी का नाम बताइए, और अपनी वर्तमान लोकेशन कैप्चर करें, तभी मैं शिकायत दर्ज कर सकूंगा।"
      : "Please describe the issue clearly, share a landmark or location name, and capture your current location so I can register the complaint.";
  }

  if (hasDescription && hasCoordinates) {
    return language === "hi"
      ? "कृपया समस्या स्पष्ट बताइए और अपनी वर्तमान लोकेशन कैप्चर करें, तभी मैं शिकायत दर्ज कर सकूंगा।"
      : "Please describe the issue clearly and capture your current location so I can register the complaint.";
  }

  if (hasDescription && hasLocationName && hasImages) {
    return language === "hi"
      ? "कृपया समस्या स्पष्ट बताइए, किसी पहचानने योग्य स्थान या कॉलोनी का नाम बताइए, और कम से कम एक प्रूफ इमेज जोड़ें, तभी मैं शिकायत दर्ज कर सकूंगा।"
      : "Please describe the issue clearly, share a landmark or location name, and add at least one proof image so I can register the complaint.";
  }

  if (hasDescription && hasImages) {
    return language === "hi"
      ? "कृपया समस्या स्पष्ट बताइए और कम से कम एक प्रूफ इमेज जोड़ें, तभी मैं शिकायत दर्ज कर सकूंगा।"
      : "Please describe the issue clearly and add at least one proof image so I can register the complaint.";
  }

  if (hasLocationName && hasCoordinates && hasImages) {
    return language === "hi"
      ? "कृपया किसी पहचानने योग्य स्थान, कॉलोनी, या लैंडमार्क का नाम बताइए, अपनी वर्तमान लोकेशन कैप्चर करें, और कम से कम एक प्रूफ इमेज जोड़ें, तभी मैं शिकायत दर्ज कर सकूंगा।"
      : "Please share a location name or landmark, capture your current location, and add at least one proof image so I can register the complaint.";
  }

  if (hasCoordinates && hasImages) {
    return copy.complaintNeedLocationAndImages;
  }

  if (hasDescription && hasLocationName) {
    return language === "hi"
      ? "कृपया समस्या स्पष्ट बताइए और किसी पहचानने योग्य स्थान, कॉलोनी, या लैंडमार्क का नाम बताइए, ताकि मैं शिकायत दर्ज कर सकूं।"
      : "Please describe the issue clearly and share a location name or landmark so I can register the complaint.";
  }

  if (hasDescription) {
    return language === "hi"
      ? "कृपया समस्या थोड़ी स्पष्ट बताइए, मैं शिकायत दर्ज कर दूंगा।"
      : "Please describe the issue clearly, and I will register the complaint.";
  }

  if (hasLocationName && hasCoordinates) {
    return language === "hi"
      ? "कृपया किसी पहचानने योग्य स्थान, कॉलोनी, या लैंडमार्क का नाम बताइए और अपनी वर्तमान लोकेशन कैप्चर करें, ताकि मैं शिकायत सही जगह पर दर्ज कर सकूं।"
      : "Please share a location name or landmark and capture your current location so I can register the complaint correctly.";
  }

  if (hasCoordinates) {
    return copy.complaintNeedCoordinates;
  }

  if (hasLocationName && hasImages) {
    return language === "hi"
      ? "कृपया किसी पहचानने योग्य स्थान, कॉलोनी, या लैंडमार्क का नाम बताइए और कम से कम एक प्रूफ इमेज जोड़ें, तभी मैं शिकायत दर्ज कर सकूंगा।"
      : "Please share a location name or landmark and add at least one proof image so I can register the complaint.";
  }

  if (hasLocationName) {
    return language === "hi"
      ? "कृपया किसी पहचानने योग्य स्थान, कॉलोनी, या लैंडमार्क का नाम बताइए, ताकि मैं शिकायत सही जगह पर दर्ज कर सकूं।"
      : "Please share a location name or landmark, such as your colony, area, or a nearby place, so I can register the complaint correctly.";
  }

  if (hasImages) {
    return copy.complaintNeedImages;
  }

  return copy.complaintNeedDetails;
}

function extractContinuationLocationName(message = "") {
  const value = String(message || "").trim();
  if (!value) return null;

  const explicitPatterns = [
    /(?:location|address)\s*(?:is|h|hai|:)?\s*([^.!?\n]{3,120})/i,
    /(?:लोकेशन|स्थान|पता)\s*(?:है|:)?\s*([^.!?\n]{3,120})/i,
    /(?:at|near|in)\s+([^.!?\n]{3,120})/i,
    /(?:के\s+पास|के\s+सामने|में)\s+([^.!?\n]{3,120})/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const locationLikeSegment = value
    .split(/[,.\n]/)
    .map((segment) => segment.trim())
    .find((segment) =>
      /\b(colony|nagar|mandir|road|street|sector|block|area|gali|chowk|park|hospital|school)\b/i.test(
        segment,
      ) || /(कॉलोनी|नगर|रोड|सड़क|गली|चौराहा|मंदिर|पार्क|हॉस्पिटल|स्कूल)/.test(segment),
    );

  return locationLikeSegment || null;
}

function extractContinuationDescription(message = "") {
  const value = String(message || "").trim();
  if (!value) return null;

  const normalized = value
    .replace(
      /(?:लोकेशन|स्थान|पता|location|address)\s*(?:is|h|hai|है|:)?\s*[^.!?\n]+/gi,
      " ",
    )
    .replace(/\b(register|raise|file|lodge|check|show|track)\b/gi, " ")
    .replace(/\b(complaint|issue|problem|status)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;
  if (/^\d+(\.\d+)?\s*,\s*\d+(\.\d+)?$/.test(normalized)) return null;
  if (/^use these location coordinates/i.test(normalized)) return null;

  return normalized.length >= 6 ? normalized : null;
}

function toComplaintCard(complaint) {
  if (!complaint) return null;
  const view = buildComplaintView(complaint);
  return {
    id: String(view.id || complaint._id || ""),
    ticketId: view.ticketId,
    title: view.title,
    description: view.description,
    status: view.status,
    department: view.department,
    priority: view.priority,
    locationName: view.locationName,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

function formatComplaintList(complaints = []) {
  return complaints
    .map(
      (complaint, index) =>
        `${index + 1}. ${complaint.ticketId} - ${complaint.status} (${complaint.department}, ${complaint.priority})`,
    )
    .join("\n");
}

function getOpenAIApiKey() {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return "";
  return String(raw)
    .trim()
    .replace(/^['\"]|['\"]$/g, "");
}

function resolveAudioMimeType(
  mimetype = "",
  originalname = "",
  provider = "generic",
) {
  const normalized = String(mimetype || "").toLowerCase();
  const fileName = String(originalname || "").toLowerCase();
  const isGemini = String(provider || "").toLowerCase() === "gemini";

  if (
    normalized === "audio/m4a" ||
    normalized === "audio/x-m4a" ||
    normalized === "audio/mp4" ||
    fileName.endsWith(".m4a")
  ) {
    return isGemini ? "audio/aac" : "audio/mp4";
  }

  if (normalized === "application/octet-stream") {
    if (fileName.endsWith(".m4a") || fileName.endsWith(".aac")) {
      return isGemini ? "audio/aac" : "audio/mp4";
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

  const mimeType = resolveAudioMimeType(
    reqFile.mimetype,
    reqFile.originalname,
    "whisper",
  );
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
    const message = String(req.body?.message || "").trim();
    const conversationHistory = parseConversationHistory(
      req.body?.conversationHistory,
    );
    const hasUploadedImages = Array.isArray(req.files) && req.files.length > 0;
    const hasIncomingCoordinates = Boolean(parseCoordinates(req.body?.coordinates));

    if (!message && !hasUploadedImages && !hasIncomingCoordinates) {
      return res.status(400).json({ error: "Message is required" });
    }

    const departmentNames = await getDepartmentNames();
    const analysis = await analyzeAssistantRequest(
      message,
      conversationHistory,
      departmentNames,
    );
    const pendingRegistrationContext =
      getPendingRegistrationContext(conversationHistory);
    const language =
      analysis.language ||
      pendingRegistrationContext?.assistantMeta?.language ||
      detectLanguage(message);
    const copy = await getLanguagePack(language);
    const fallbackTicketId = extractTicketId(message);
    const effectiveTicketId = analysis.ticketId || fallbackTicketId;
    const hasIncomingImages = hasUploadedImages;
    const hasComplaintDraftHints = Boolean(
      String(analysis?.complaintDraft?.description || "").trim() ||
      String(analysis?.complaintDraft?.locationName || "").trim(),
    );
    const shouldTreatAsRegistration =
      analysis.intent === "register_complaint" ||
      Boolean(pendingRegistrationContext) ||
      ((hasIncomingCoordinates || hasIncomingImages || hasComplaintDraftHints) &&
        analysis.intent !== "complaint_status" &&
        analysis.intent !== "recent_complaints");

    if (analysis.intent === "recent_complaints") {
      if (!req.user?._id) {
        return res.json(
          createAssistantResponse(copy.statusAuth, {
            intent: "recent_complaints",
            found: false,
            complaints: [],
            language,
          }),
        );
      }

      const complaints = await findRecentComplaintsForUser(req.user._id, 5);

      if (!complaints.length) {
        return res.json(
          createAssistantResponse(copy.noComplaints, {
            intent: "recent_complaints",
            found: false,
            complaints: [],
            language,
          }),
        );
      }

      const complaintCards = complaints.map((complaint) =>
        toComplaintCard(complaint),
      );

      return res.json(
        createAssistantResponse(`${copy.recentHeader}\n${formatComplaintList(complaints)}`, {
          intent: "recent_complaints",
          found: true,
          complaints: complaintCards,
          language,
        }),
      );
    }

    if (analysis.intent === "complaint_status" || effectiveTicketId) {
      if (!req.user?._id) {
        return res.status(401).json({
          error: copy.statusAuth,
        });
      }

      if (!effectiveTicketId) {
        return res.json(
          createAssistantResponse(
            language === "hi"
              ? "कृपया शिकायत आईडी भेजिए, जैसे RD123456."
              : "Please share the complaint ID, for example RD123456.",
            {
              intent: "complaint_status",
              found: false,
              ticketId: null,
              language,
            },
          ),
        );
      }

      const complaint = await findComplaintByTicketId(effectiveTicketId);
      if (!complaint) {
        return res.json(
          createAssistantResponse(copy.notFound(effectiveTicketId), {
            intent: "complaint_status",
            found: false,
            ticketId: effectiveTicketId,
            language,
          }),
        );
      }

      if (!(await canUserAccessComplaint(req.user, complaint))) {
        return res.status(403).json({
          error: copy.forbidden,
        });
      }

      return res.json(
        createAssistantResponse(copy.statusLine(complaint.ticketId, complaint.status), {
          intent: "complaint_status",
          found: true,
          complaint: toComplaintCard(complaint),
          language,
        }),
      );
    }

    if (shouldTreatAsRegistration) {
      if (!req.user?._id) {
        return res.status(401).json({
          error: copy.complaintAuth,
        });
      }

      const forcedDraft =
        pendingRegistrationContext?.assistantMeta?.complaintDraft || null;
      const latestAttachmentState = getLatestAttachmentState(conversationHistory);
      const draft = {
        ...(forcedDraft || {}),
        ...(analysis.complaintDraft || {}),
      };
      const persistedCoordinates =
        parseCoordinates(
          pendingRegistrationContext?.assistantMeta?.collectedCoordinates,
        ) || latestAttachmentState.coordinates;
      const coordinates =
        parseCoordinates(req.body?.coordinates) || persistedCoordinates;
      const uploadedImages = await uploadComplaintImages(req.files || []);
      const collectedImages = uniqueImageUrls([
        ...(pendingRegistrationContext?.assistantMeta?.collectedImages || []),
        ...latestAttachmentState.images,
        ...uploadedImages,
      ]);
      const missingFields = uniqueMissingFields(
        Array.isArray(pendingRegistrationContext?.assistantMeta?.missingFields)
          ? pendingRegistrationContext.assistantMeta.missingFields
          : Array.isArray(analysis.missingFields)
            ? analysis.missingFields
            : [],
      );

      if (
        forcedDraft &&
        (!analysis.complaintDraft ||
          !String(analysis.complaintDraft.description || "").trim())
      ) {
        if (!draft.description && forcedDraft.description) {
          draft.description = forcedDraft.description;
        }
        if (!draft.title && forcedDraft.title) {
          draft.title = forcedDraft.title;
        }
        if (!draft.department && forcedDraft.department) {
          draft.department = forcedDraft.department;
        }
        if (!draft.priority && forcedDraft.priority) {
          draft.priority = forcedDraft.priority;
        }
        if (!draft.locationName && forcedDraft.locationName) {
          draft.locationName = forcedDraft.locationName;
        }
      }

      if (
        forcedDraft &&
        !draft.locationName &&
        missingFields.includes("locationName") &&
        looksLikeStandaloneLocationMessage(message)
      ) {
        draft.locationName =
          extractContinuationLocationName(message) || String(message || "").trim();
        removeMissingField(missingFields, "locationName");
      }

      if (forcedDraft) {
        if (!draft.description) {
          const inferredDescription = extractContinuationDescription(message);
          if (inferredDescription) {
            draft.description = inferredDescription;
          }
        }

        if (!draft.locationName) {
          const inferredLocationName = extractContinuationLocationName(message);
          if (inferredLocationName) {
            draft.locationName = inferredLocationName;
          }
        }
      }

      if (draft.description) {
        removeMissingField(missingFields, "description");
      }

      if (coordinates) {
        removeMissingField(missingFields, "coordinates");
      }

      if (draft.locationName) {
        removeMissingField(missingFields, "locationName");
      }

      if (collectedImages.length > 0) {
        removeMissingField(missingFields, "images");
      }

      const requiredMissingFields = computeRegistrationMissingFields({
        description: draft.description,
        locationName: draft.locationName,
        coordinates,
        collectedImages,
      });
      const shouldCreateComplaint =
        requiredMissingFields.length === 0 &&
        Boolean(String(draft.description || "").trim());

      if (
        requiredMissingFields.length > 0 ||
        (!pendingRegistrationContext &&
          !analysis.shouldCreateComplaint &&
          !shouldCreateComplaint)
      ) {
        const response = buildRegistrationFollowUpResponse(
          copy,
          language,
          requiredMissingFields,
        );
        return res.json(
          createAssistantResponse(response, {
            intent: "register_complaint",
            created: false,
            missingFields: requiredMissingFields,
            complaintDraft: draft,
            collectedCoordinates: coordinates,
            collectedImages,
            requiredLocationCapture: !coordinates,
            requiredImages: collectedImages.length === 0,
            language,
          }),
        );
      }

      const normalizedDepartment = departmentNames.includes(draft.department)
        ? draft.department
        : "Other";
      const complaint = await Complaint.create({
        userId: req.user._id,
        rawText: `${draft.title || buildComplaintTitle(draft.description, normalizedDepartment)}: ${draft.description}`,
        refinedText: draft.description,
        department: normalizedDepartment,
        locationName: draft.locationName,
        coordinates,
        priority: draft.priority || "Medium",
        proofImage: collectedImages,
        status: "pending",
        history: [
          {
            status: "pending",
            updatedBy: req.user._id,
            note: "Created from assistant chat",
          },
        ],
        chatHistory: conversationHistory
          .slice(-10)
          .map((entry) => ({
            role: entry.role || "user",
            content: String(entry.text || entry.content || "").trim(),
          }))
          .filter((entry) => entry.content),
      });

      if (req.user?.email) {
        void sendComplaintRegistered(
          req.user.email,
          req.user.fullName || req.user.username,
          {
            _id: complaint._id,
            ticketId: complaint.ticketId,
            title: draft.title || buildComplaintTitle(draft.description, normalizedDepartment),
            department: normalizedDepartment,
            priority: complaint.priority,
            locationName: draft.locationName,
          },
        );
      }

      return res.status(201).json(
        createAssistantResponse(
          `${copy.complaintCreated} ${copy.statusLine(complaint.ticketId, complaint.status)}`,
          {
            intent: "register_complaint",
            created: true,
            complaint: toComplaintCard(complaint),
            language,
          },
        ),
      );
    }

    const response =
      analysis.generalResponse ||
      (await generateChatResponse(message, conversationHistory, language));

    return res.json(
      createAssistantResponse(response, {
        intent: analysis.intent || "general",
        language,
      }),
    );
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
      const canUseWhisper = Boolean(getOpenAIApiKey());

      if (!hasGeminiClient()) {
        if (!canUseWhisper) {
          return res.status(500).json({
            error:
              "Speech recognition service not available - no provider configured",
          });
        }
        transcription = await transcribeWithWhisper(req.file);
      } else {
        try {
          const base64Audio = req.file.buffer.toString("base64");
          const mimeType = resolveAudioMimeType(
            req.file.mimetype,
            req.file.originalname,
            "gemini",
          );
          const prompt =
            "Please transcribe this audio file to text. Only return the transcribed text, nothing else.";
          transcription = await runGeminiWithFallback(prompt, {
            data: base64Audio,
            mimeType,
          });
        } catch (geminiError) {
          if (!canUseWhisper) throw geminiError;
          transcription = await transcribeWithWhisper(req.file);
        }

        if (!String(transcription || "").trim() && canUseWhisper) {
          transcription = await transcribeWithWhisper(req.file);
        }
      }
    }

    if (!transcription) {
      return res.status(422).json({ error: "No speech detected" });
    }

      return res.json({
        text: transcription,
        language: await detectLanguageWithModel(transcription),
      });
  } catch (error) {
    console.error("Speech-to-text error:", error);
    return res.status(500).json({
      error: "Failed to transcribe audio",
      details: error?.message || "Unknown speech transcription error",
    });
  }
}

module.exports = { handleMessage, handleSpeechToText };
