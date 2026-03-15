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
  const withTimeout = (promise, timeoutMs, fallbackValue) => {
    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
    });

    return Promise.race([
      Promise.resolve(promise).catch(() => fallbackValue),
      timeoutPromise,
    ]).finally(() => clearTimeout(timeoutId));
  };

  const coordinates = parseCoordinates(req.body.coordinates);
  validateCreateComplaint({
    body: req.body,
    coordinates,
    files: req.files,
  });

  const { title, description, department, locationName, priority } = req.body;
  const proofImages = await uploadComplaintImages(req.files || []);

  let aiAnalysis = null;
  let aiSuggestedDepartment = department;
  let aiSuggestedPriority = priority;
  let aiConfidence = 0;

  try {
    const imageUrl =
      proofImages && proofImages.length > 0 ? proofImages[0] : null;
    const [aiResult, sentimentResult] = await Promise.all([
      withTimeout(
        analyzeComplaintWithImage(description, imageUrl),
        4500,
        null,
      ),
      withTimeout(analyzeSentiment(description), 3500, null),
    ]);

    const VALID_DEPARTMENTS = [
      "Road",
      "Water",
      "Electricity",
      "Waste",
      "Drainage",
      "Other",
    ];
    if (aiResult && !aiResult.error) {
      const rawDept = aiResult.department;
      aiSuggestedDepartment = VALID_DEPARTMENTS.includes(rawDept)
        ? rawDept
        : department || "Other";
      aiSuggestedPriority = aiResult.suggestedPriority || priority;
      aiConfidence = (aiResult.confidence || 50) / 100;
    }

    if (sentimentResult && !sentimentResult.error) {
      aiAnalysis = {
        sentiment: sentimentResult.sentiment || "unknown",
        urgency: sentimentResult.urgency || 5,
        keywords: sentimentResult.keywords || [],
        affectedCount: sentimentResult.affectedCount || 1,
        suggestedPriority: sentimentResult.suggestedPriority || priority,
        reasoning: aiResult?.reasoning || null,
        department: aiSuggestedDepartment || null,
        confidence: aiConfidence,
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

  let complaint;
  const createdByName =
    req.user?.username || req.user?.fullName || String(req.user?._id || "user");
  try {
    complaint = await Complaint.create({
      userId: req.user._id,
      rawText: `${title}: ${description}`,
      refinedText: description,
      department: finalDepartment,
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
            ? `Created by ${createdByName} - AI auto-categorized (${Math.round(aiConfidence * 100)}% confidence)`
            : `Created by ${createdByName}`,
        },
      ],
    });
  } catch (err) {
    if (err.code === 11000)
      throw new AppError("Ticket ID conflict, please try again", 500);
    throw err;
  }

  void notifyUser(req.user._id, {
    title: "Complaint Received",
    body: `Ticket ${complaint.ticketId} has been created.`,
    data: { type: "complaint-update", complaintId: String(complaint._id) },
  }).catch((notificationError) => {
    console.error("Failed to send complaint notification:", notificationError);
  });

  if (req.user?.email) {
    void sendComplaintRegistered(
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
  }

  return sendSuccess(
    res,
    { complaint: buildComplaintView(complaint) },
    "Complaint created",
    201,
  );
});

exports.myComplaints = asyncHandler(async (req, res) => {
  const {
    scope = "mine",
    status,
    excludeStatus,
    department,
    priority,
    sort = "new-to-old",
    startDate,
    endDate,
    search,
    limit = 10,
    page = 1,
  } = req.query;

  const safeLimit = Math.min(Number(limit) || 10, 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const filter = {};
  if (scope !== "all") {
    filter.userId = new mongoose.Types.ObjectId(req.user._id);
  }
  if (status && status !== "all") filter.status = status;
  if (!status && excludeStatus) {
    const excludedStatuses = String(excludeStatus)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (excludedStatuses.length > 0) {
      filter.status = { $nin: excludedStatuses };
    }
  }
  if (department && department !== "all") {
    filter.department = new RegExp(`^${department}$`, "i");
  }
  if (priority && priority !== "all")
    filter.priority = new RegExp(`^${priority}$`, "i");
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  if (search && search.trim()) {
    const re = new RegExp(
      search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    filter.$or = [
      { ticketId: re },
      { locationName: re },
      { rawText: re },
      { refinedText: re },
    ];
  }

  const sortDir = sort === "old-to-new" ? 1 : -1;
  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .sort({ createdAt: sortDir })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    Complaint.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    total,
    page: safePage,
    pages: Math.ceil(total / safeLimit),
    limit: safeLimit,
    complaints: complaints.map((complaint) =>
      buildComplaintView(complaint, { currentUserId: req.user._id }),
    ),
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

  if (req.user?.role !== "user") {
    await assertCanAccessComplaint(req.user, complaint);
  }
  return sendSuccess(res, {
    complaint: buildComplaintView(complaint, { currentUserId: req.user._id }),
  });
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

exports.getNearbyComplaints = asyncHandler(async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const radius = Math.min(parseFloat(req.query.radius) || 5, 50);

  if (
    isNaN(lat) ||
    isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new AppError("Valid lat and lng query parameters are required", 400);
  }

  // Bounding box pre-filter (1° lat ≈ 111 km)
  const latDelta = radius / 111;
  const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

  const candidates = await Complaint.find({
    "coordinates.lat": { $gte: lat - latDelta, $lte: lat + latDelta },
    "coordinates.lng": { $gte: lng - lngDelta, $lte: lng + lngDelta },
    status: { $nin: ["resolved", "cancelled"] },
  })
    .select(
      "ticketId refinedText rawText department status priority locationName coordinates upvoteCount upvotes createdAt",
    )
    .sort({ upvoteCount: -1, createdAt: -1 })
    .limit(50)
    .lean();

  const haversine = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  };

  const currentUserId = String(req.user?._id || "");

  const nearby = candidates
    .filter((c) => c.coordinates?.lat != null && c.coordinates?.lng != null)
    .map((c) => ({
      ...c,
      hasUpvoted: (c.upvotes || []).some(
        (id) => String(id) === currentUserId,
      ),
      distance:
        Math.round(
          haversine(lat, lng, c.coordinates.lat, c.coordinates.lng) * 10,
        ) / 10,
    }))
    .filter((c) => c.distance <= radius)
    .sort((a, b) => b.upvoteCount - a.upvoteCount || a.distance - b.distance)
    .slice(0, 20);

  return sendSuccess(res, { complaints: nearby });
});
