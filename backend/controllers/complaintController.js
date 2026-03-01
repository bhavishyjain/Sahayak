const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const generateTicketId = require("../utils/generateTicketId");
const { notifyUser } = require("./notificationController");
const { buildComplaintView } = require("../utils/complaintView");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const {
  validateCreateComplaint,
  validateFeedbackBody,
} = require("../validators/complaintValidators");
const {
  parseCoordinates,
  uploadComplaintImages,
  applyUpvotePolicy,
} = require("../services/complaintService");
const { sendComplaintRegistered } = require("../services/emailService");

exports.createComplaint = asyncHandler(async (req, res) => {
  validateCreateComplaint(req.body);

  const { title, description, department, locationName, priority } = req.body;
  const coordinates = parseCoordinates(req.body.coordinates);
  const proofImages = await uploadComplaintImages(req.files || []);

  const complaint = await Complaint.create({
    ticketId: generateTicketId(),
    userId: req.user._id,
    rawText: `${title}: ${description}`,
    refinedText: description,
    department,
    locationName,
    coordinates,
    priority: ["Low", "Medium", "High"].includes(priority)
      ? priority
      : "Medium",
    proofImage: proofImages,
    status: "pending",
    history: [
      {
        status: "pending",
        updatedBy: req.user._id,
        note: "Created from app",
      },
    ],
  });

  await notifyUser(req.user._id, {
    title: "Complaint Received",
    body: `Ticket ${complaint.ticketId} has been created.`,
    data: { type: "complaint_created", complaintId: String(complaint._id) },
  });

  // Send email confirmation
  try {
    await sendComplaintRegistered(
      req.user.email,
      req.user.fullName || req.user.username,
      {
        _id: complaint._id,
        ticketId: complaint.ticketId,
        title: complaint.refinedText || title,
        department,
        priority: complaint.priority,
        locationName,
      },
    );
  } catch (emailError) {
    console.error("Failed to send registration email:", emailError);
    // Continue anyway - don't block complaint creation
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
    "assignedTo",
    "fullName username",
  );

  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }

  const isOwner = String(complaint.userId) === String(req.user._id);
  const elevatedRoles = ["admin", "head", "worker"];

  if (!isOwner && !elevatedRoles.includes(req.user.role)) {
    throw new AppError("Forbidden", 403);
  }

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
