const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const { buildComplaintView } = require("../../utils/complaintView");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const {
  normalizeDepartment,
} = require("../../policies/complaintPolicy");
const { emitComplaintUpdated } = require("../../services/realtimeService");
const {
  appendComplaintHistory,
} = require("../../services/complaintWorkflowService");

function normalizeComparisonValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function hasChangedValue(currentValue, suggestedValue) {
  if (suggestedValue == null || String(suggestedValue).trim() === "") {
    return false;
  }

  return (
    normalizeComparisonValue(currentValue) !==
    normalizeComparisonValue(suggestedValue)
  );
}

async function assertCanApplyAISuggestion(reqUser, complaint) {
  if (reqUser?.role === "admin") {
    return;
  }

  const actor = await User.findById(reqUser?._id).select("role department");
  if (!actor || actor.role !== "head") {
    throw new AppError("Forbidden", 403);
  }

  const actorDepartment = normalizeDepartment(actor.department);
  const currentDepartment = normalizeDepartment(complaint.department);
  const suggestedDepartment = normalizeDepartment(
    complaint.aiAnalysis?.department,
  );

  if (
    actorDepartment !== currentDepartment &&
    actorDepartment !== suggestedDepartment
  ) {
    throw new AppError("Forbidden", 403);
  }
}

exports.applyAISuggestion = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { applyDepartment, applyPriority } = req.body;

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }
  await assertCanApplyAISuggestion(req.user, complaint);

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
  const { department, type, page, limit } = req.query;
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
  const normalizedType = String(type || "all")
    .trim()
    .toLowerCase();
  const requestedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const requestedLimit = Math.max(
    1,
    Math.min(50, Number.parseInt(limit, 10) || 20),
  );

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

  const complaints = await Complaint.find(filter).populate(
    "userId",
    "fullName username",
  );

  const formatted = complaints.map((c) => {
    const view = buildComplaintView(c);
    const suggestedDepartment = c.aiAnalysis?.department;
    const suggestedPriority = c.aiAnalysis?.suggestedPriority;
    const departmentChanged = hasChangedValue(c.department, suggestedDepartment);
    const priorityChanged = hasChangedValue(c.priority, suggestedPriority);

    return {
      ...view,
      aiSuggestion: {
        department: suggestedDepartment,
        priority: suggestedPriority,
        confidence: Math.round((c.aiAnalysis?.confidence ?? 0) * 100),
        reasoning: c.aiAnalysis?.reasoning,
        sentiment: c.aiAnalysis?.sentiment,
        urgency: c.aiAnalysis?.urgency,
      },
      currentValues: {
        department: c.department,
        priority: c.priority,
      },
      reviewMeta: {
        departmentChanged,
        priorityChanged,
        confidence: Number(c.aiAnalysis?.confidence ?? 0),
        createdAt: c.createdAt,
      },
    };
  });

  const departmentShiftCount = formatted.filter(
    (item) => item.reviewMeta?.departmentChanged,
  ).length;
  const priorityShiftCount = formatted.filter(
    (item) => item.reviewMeta?.priorityChanged,
  ).length;

  const filteredComplaints = formatted.filter((item) => {
    const departmentChanged = Boolean(item.reviewMeta?.departmentChanged);
    const priorityChanged = Boolean(item.reviewMeta?.priorityChanged);

    if (normalizedType === "department") {
      return departmentChanged && !priorityChanged;
    }
    if (normalizedType === "priority") {
      return priorityChanged && !departmentChanged;
    }
    if (normalizedType === "both") {
      return departmentChanged && priorityChanged;
    }
    return departmentChanged || priorityChanged;
  });

  const prioritizedComplaints = filteredComplaints
    .sort((left, right) => {
      const departmentScore =
        Number(Boolean(right.reviewMeta?.departmentChanged)) -
        Number(Boolean(left.reviewMeta?.departmentChanged));
      if (departmentScore !== 0) return departmentScore;

      const priorityScore =
        Number(Boolean(right.reviewMeta?.priorityChanged)) -
        Number(Boolean(left.reviewMeta?.priorityChanged));
      if (priorityScore !== 0) return priorityScore;

      const confidenceScore =
        Number(right.reviewMeta?.confidence ?? 0) -
        Number(left.reviewMeta?.confidence ?? 0);
      if (confidenceScore !== 0) return confidenceScore;

      return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
    });

  const total = prioritizedComplaints.length;
  const totalPages = Math.max(1, Math.ceil(total / requestedLimit));
  const currentPage = Math.min(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * requestedLimit;
  const paginatedComplaints = prioritizedComplaints.slice(
    startIndex,
    startIndex + requestedLimit,
  );

  return sendSuccess(
    res,
    {
      total,
      departmentShiftCount,
      priorityShiftCount,
      complaints: paginatedComplaints,
      pagination: {
        page: currentPage,
        limit: requestedLimit,
        total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1,
      },
    },
    "Complaints needing review retrieved successfully",
  );
});
