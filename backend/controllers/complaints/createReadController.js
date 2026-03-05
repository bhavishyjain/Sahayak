const mongoose = require("mongoose");
const Complaint = require("../../models/Complaint");
const { notifyUser } = require("../notificationController");
const { buildComplaintView } = require("../../utils/complaintView");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const {
  validateCreateComplaint,
  validateFeedbackBody,
} = require("../../validators/complaintValidators");
const {
  parseCoordinates,
  uploadComplaintImages,
  applyUpvotePolicy,
} = require("../../services/complaintService");
const { sendComplaintRegistered } = require("../../services/emailService");
const {
  analyzeComplaintWithImage,
  analyzeSentiment,
} = require("../../services/geminiService");
const { assertCanAccessComplaint } = require("../../policies/complaintPolicy");

exports.createComplaint = asyncHandler(async (req, res) => {
  validateCreateComplaint(req.body);

  const { title, description, department, locationName, priority } = req.body;
  const coordinates = parseCoordinates(req.body.coordinates);
  const proofImages = await uploadComplaintImages(req.files || []);

  let aiAnalysis = null;
  let aiSuggestedDepartment = department;
  let aiSuggestedPriority = priority;
  let aiConfidence = 0;

  try {
    const imageUrl =
      proofImages && proofImages.length > 0 ? proofImages[0] : null;
    const aiResult = await analyzeComplaintWithImage(description, imageUrl);

    if (aiResult && !aiResult.error) {
      aiSuggestedDepartment = aiResult.department || department;
      aiSuggestedPriority = aiResult.suggestedPriority || priority;
      aiConfidence = (aiResult.confidence || 50) / 100;
    }

    const sentimentResult = await analyzeSentiment(description);
    if (sentimentResult && !sentimentResult.error) {
      aiAnalysis = {
        sentiment: sentimentResult.sentiment || "unknown",
        urgency: sentimentResult.urgency || 5,
        keywords: sentimentResult.keywords || [],
        affectedCount: sentimentResult.affectedCount || 1,
        suggestedPriority: sentimentResult.suggestedPriority || priority,
        reasoning: aiResult?.reasoning || null,
      };

      if (sentimentResult.suggestedPriority === "High" && priority !== "High") {
        aiSuggestedPriority = "High";
      }
    }
  } catch (aiError) {
    console.error("AI analysis failed:", aiError);
  }

  let finalDepartment = department;
  let finalPriority = priority;
  let aiAutoApplied = false;

  if (!department && aiConfidence > 0.7) {
    finalDepartment = aiSuggestedDepartment;
    aiAutoApplied = true;
  } else if (!department) {
    finalDepartment = aiSuggestedDepartment || "Other";
  }

  if (!priority && aiConfidence > 0.7) {
    finalPriority = aiSuggestedPriority;
  } else if (!priority) {
    finalPriority = aiSuggestedPriority || "Medium";
  }

  const complaint = await Complaint.create({
    userId: req.user._id,
    rawText: `${title}: ${description}`,
    refinedText: description,
    department: finalDepartment,
    aiSuggestedDepartment,
    aiConfidence,
    aiAnalysis,
    locationName,
    coordinates,
    priority: finalPriority,
    proofImage: proofImages,
    status: "pending",
    history: [
      {
        status: "pending",
        updatedBy: req.user._id,
        note: aiAutoApplied
          ? `Created from app - AI auto-categorized (${Math.round(aiConfidence * 100)}% confidence)`
          : "Created from app",
      },
    ],
  });

  await notifyUser(req.user._id, {
    title: "Complaint Received",
    body: `Ticket ${complaint.ticketId} has been created.`,
    data: { type: "complaint_created", complaintId: String(complaint._id) },
  });

  try {
    await sendComplaintRegistered(
      req.user.email,
      req.user.fullName || req.user.username,
      {
        _id: complaint._id,
        ticketId: complaint.ticketId,
        title: complaint.refinedText || title,
        department: finalDepartment,
        priority: complaint.priority,
        locationName,
      },
    );
  } catch (emailError) {
    console.error("Failed to send registration email:", emailError);
  }

  return sendSuccess(
    res,
    { complaint: buildComplaintView(complaint) },
    "Complaint created",
    201,
  );
});

exports.myComplaints = asyncHandler(async (req, res) => {
  const { status, limit = 20, page = 1 } = req.query;
  const safeLimit = Math.min(Number(limit) || 20, 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const filter = { userId: new mongoose.Types.ObjectId(req.user._id) };
  if (status && status !== "all") {
    filter.status = status;
  }

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Complaint.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    total,
    page: safePage,
    limit: safeLimit,
    complaints: complaints.map(buildComplaintView),
  });
});

exports.getComplaintById = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const complaint = await Complaint.findById(complaintId).populate(
    "assignedWorkers.workerId",
    "fullName username",
  );

  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }

  await assertCanAccessComplaint(req.user, complaint);
  return sendSuccess(res, { complaint: buildComplaintView(complaint) });
});

exports.upvoteComplaint = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const userId = req.user._id;

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }

  const hasUpvoted = complaint.upvotes.some(
    (id) => String(id) === String(userId),
  );
  applyUpvotePolicy(complaint, userId, hasUpvoted);
  await complaint.save();

  return sendSuccess(
    res,
    {
      upvoteCount: complaint.upvoteCount,
      hasUpvoted: !hasUpvoted,
    },
    hasUpvoted ? "Upvote removed" : "Upvoted successfully",
  );
});

exports.submitFeedback = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user._id;
  validateFeedbackBody(req.body);

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }

  if (complaint.status !== "resolved") {
    throw new AppError(
      "Feedback can only be submitted for resolved complaints",
      400,
    );
  }

  if (String(complaint.userId) !== String(userId)) {
    throw new AppError("Only complaint owner can submit feedback", 403);
  }

  if (complaint.feedback && complaint.feedback.rating) {
    throw new AppError("Feedback already submitted for this complaint", 400);
  }

  complaint.feedback = {
    rating: Number(rating),
    comment: comment || "",
    ratedBy: userId,
    ratedAt: new Date(),
  };

  await complaint.save();

  return sendSuccess(
    res,
    { feedback: complaint.feedback },
    "Feedback submitted successfully",
  );
});
