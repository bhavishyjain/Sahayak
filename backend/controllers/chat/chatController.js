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
    const { message } = req.body;
    const conversationHistory = parseConversationHistory(
      req.body?.conversationHistory,
    );

    if (!message) {
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

    if (
      analysis.intent === "register_complaint" ||
      pendingRegistrationContext
    ) {
      if (!req.user?._id) {
        return res.status(401).json({
          error: copy.complaintAuth,
        });
      }

      const forcedDraft =
        pendingRegistrationContext?.assistantMeta?.complaintDraft || null;
      const draft = {
        ...(forcedDraft || {}),
        ...(analysis.complaintDraft || {}),
      };
      const coordinates = parseCoordinates(req.body?.coordinates);
      const uploadedImages = await uploadComplaintImages(req.files || []);
      const missingFields = Array.isArray(
        pendingRegistrationContext?.assistantMeta?.missingFields,
      )
        ? pendingRegistrationContext.assistantMeta.missingFields.filter(Boolean)
        : Array.isArray(analysis.missingFields)
        ? analysis.missingFields.filter(Boolean)
        : [];

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
        draft.locationName = String(message || "").trim();
        const locationIndex = missingFields.indexOf("locationName");
        if (locationIndex >= 0) missingFields.splice(locationIndex, 1);
      }

      if (!draft.description && !missingFields.includes("description")) {
        missingFields.push("description");
      }
      if (!draft.locationName && !missingFields.includes("locationName")) {
        missingFields.push("locationName");
      }
      if (
        !coordinates &&
        !missingFields.includes("coordinates")
      ) {
        missingFields.push("coordinates");
      } else if (coordinates) {
        const index = missingFields.indexOf("coordinates");
        if (index >= 0) missingFields.splice(index, 1);
      }

      if (uploadedImages.length === 0 && !missingFields.includes("images")) {
        missingFields.push("images");
      } else if (uploadedImages.length > 0) {
        const index = missingFields.indexOf("images");
        if (index >= 0) missingFields.splice(index, 1);
      }

      if (
        missingFields.length > 0 ||
        (!pendingRegistrationContext && !analysis.shouldCreateComplaint)
      ) {
        let response = copy.complaintNeedDetails;
        if (
          missingFields.includes("coordinates") &&
          missingFields.includes("images")
        ) {
          response = copy.complaintNeedLocationAndImages;
        } else if (missingFields.includes("coordinates")) {
          response = copy.complaintNeedCoordinates;
        } else if (missingFields.includes("images")) {
          response = copy.complaintNeedImages;
        } else if (
          missingFields.length === 1 &&
          missingFields[0] === "locationName"
        ) {
          response = copy.complaintNeedLocation;
        }
        return res.json(
          createAssistantResponse(response, {
            intent: "register_complaint",
            created: false,
            missingFields,
            complaintDraft: draft,
            requiredLocationCapture: !coordinates,
            requiredImages: uploadedImages.length === 0,
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
        proofImage: uploadedImages,
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
