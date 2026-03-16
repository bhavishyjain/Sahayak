const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const { buildComplaintView } = require("../../utils/complaintView");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const {
  assertCanManageComplaintByDepartment,
  normalizeDepartment,
} = require("../../policies/complaintPolicy");
const { emitComplaintUpdated } = require("../../services/realtimeService");
const {
  appendComplaintHistory,
} = require("../../services/complaintWorkflowService");

exports.applyAISuggestion = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { applyDepartment, applyPriority } = req.body;

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }
  await assertCanManageComplaintByDepartment(req.user, complaint);

  if (
    !complaint.aiAnalysis?.department &&
    !complaint.aiAnalysis?.suggestedPriority
  ) {
    throw new AppError("No AI suggestions available for this complaint", 400);
  }

  const changes = [];

  if (applyDepartment && complaint.aiAnalysis?.department) {
    const oldDept = complaint.department;
    complaint.department = complaint.aiAnalysis.department;
    changes.push(`Department: ${oldDept} -> ${complaint.department}`);
  }

  if (applyPriority && complaint.aiAnalysis?.suggestedPriority) {
    const oldPriority = complaint.priority;
    complaint.priority = complaint.aiAnalysis.suggestedPriority;
    changes.push(`Priority: ${oldPriority} -> ${complaint.priority}`);
  }

  if (changes.length === 0) {
    throw new AppError("No changes requested", 400);
  }

  appendComplaintHistory(complaint, {
    status: complaint.status,
    updatedBy: req.user._id,
    note: `AI suggestions applied by ${req.user.role}: ${changes.join(", ")}`,
  });

  await complaint.save();
  await emitComplaintUpdated({
    complaint,
    actorId: req.user._id,
    event: "ai-suggestion-applied",
  });

  return sendSuccess(
    res,
    { complaint: buildComplaintView(complaint) },
    "AI suggestions applied successfully",
  );
});

exports.getComplaintsNeedingReview = asyncHandler(async (req, res) => {
  const { department } = req.query;
  const mismatchFilter = {
    $or: [
      { $expr: { $ne: ["$department", "$aiAnalysis.department"] } },
      { $expr: { $ne: ["$priority", "$aiAnalysis.suggestedPriority"] } },
    ],
  };
  const filter = {
    status: { $in: ["pending", "assigned"] },
    "aiAnalysis.confidence": { $gte: 0.7 },
    $and: [mismatchFilter],
  };
  const normalizedRequestedDepartment = String(department || "").trim();

  if (req.user.role === "head") {
    const head = await User.findById(req.user._id).select("role department");
    if (!head || head.role !== "head") {
      throw new AppError("Forbidden", 403);
    }
    if (
      normalizedRequestedDepartment &&
      normalizedRequestedDepartment !== "all" &&
      normalizeDepartment(normalizedRequestedDepartment) !==
        normalizeDepartment(head.department)
    ) {
      throw new AppError("Forbidden", 403);
    }
    filter.$and.push({
      $or: [
        { department: head.department },
        { "aiAnalysis.department": head.department },
      ],
    });
  } else if (
    normalizedRequestedDepartment &&
    normalizedRequestedDepartment !== "all"
  ) {
    filter.$and.push({
      $or: [
        { department: normalizedRequestedDepartment },
        { "aiAnalysis.department": normalizedRequestedDepartment },
      ],
    });
  }

  const complaints = await Complaint.find(filter)
    .populate("userId", "fullName username")
    .sort({ "aiAnalysis.confidence": -1, createdAt: -1 })
    .limit(50);

  const formatted = complaints.map((c) => ({
    ...buildComplaintView(c),
    aiSuggestion: {
      department: c.aiAnalysis?.department,
      priority: c.aiAnalysis?.suggestedPriority,
      confidence: Math.round((c.aiAnalysis?.confidence ?? 0) * 100),
      reasoning: c.aiAnalysis?.reasoning,
      sentiment: c.aiAnalysis?.sentiment,
      urgency: c.aiAnalysis?.urgency,
    },
    currentValues: {
      department: c.department,
      priority: c.priority,
    },
  }));

  return sendSuccess(
    res,
    {
      total: formatted.length,
      complaints: formatted,
    },
    "Complaints needing review retrieved successfully",
  );
});
