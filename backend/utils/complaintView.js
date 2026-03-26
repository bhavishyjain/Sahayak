function getComplaintTitle(complaint) {
  if (complaint?.title) return complaint.title;
  return complaint?.rawText?.split(":")[0] || "Complaint";
}

function normalizeComplaintStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "canceled") return "cancelled";
  return s;
}

function hasExplicitLeader(assignments = []) {
  return assignments.some((assignment) => assignment?.isLeader === true);
}

function buildComplaintView(complaint, options = {}) {
  const includeAssignment =
    options.includeAssignment === undefined ? true : options.includeAssignment;
  const viewerId = options.currentUserId ? String(options.currentUserId) : null;
  const originalStatus = normalizeComplaintStatus(complaint.status);
  const shouldTreatDeletedAsResolved =
    options.treatDeletedAsResolved === true && complaint?.deleted === true;
  const normalizedStatus = shouldTreatDeletedAsResolved
    ? "resolved"
    : originalStatus;
  const aiSuggestedPriority =
    normalizedStatus === "pending"
      ? complaint.aiAnalysis?.suggestedPriority || null
      : null;
  const isTerminalStatus = ["resolved", "cancelled", "needs-rework"].includes(
    normalizedStatus,
  );

  const history = (complaint.history || []).map((item) => {
    const source =
      typeof item?.toObject === "function" ? item.toObject() : item || {};
    return {
      status: normalizeComplaintStatus(source.status),
      updatedBy: source.updatedBy || null,
      timestamp:
        source.timestamp ||
        source.updatedAt ||
        source.createdAt ||
        complaint.createdAt ||
        null,
      note: source.note || "",
    };
  });

  const latestNeedsReworkEntry = [...history]
    .reverse()
    .find((item) => item.status === "needs-rework" && item.note);

  const upvotes = (complaint.upvotes || []).map((id) => String(id));
  const ownerId = String(
    complaint.userId?._id || complaint.userId?.id || complaint.userId || "",
  );
  const ownerName =
    complaint.userId?.fullName || complaint.userId?.username || null;

  const base = {
    id: complaint._id,
    userId: ownerId || null,
    ownerId: ownerId || null,
    ownerName,
    ticketId: complaint.ticketId,
    title: getComplaintTitle(complaint),
    description:
      complaint.refinedText || complaint.rawText || complaint.description,
    department: complaint.department,
    priority: complaint.priority,
    status: normalizedStatus,
    originalStatus,
    deleted: Boolean(complaint.deleted),
    deletedAt: complaint.deletedAt || null,
    locationName: complaint.locationName,
    coordinates: complaint.coordinates,
    proofImage: complaint.proofImage,
    completionPhotos: complaint.completionPhotos || [],
    note: complaint.note || "",
    reworkReason: complaint.note || latestNeedsReworkEntry?.note || "",
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    assignedAt: complaint.assignedAt,
    estimatedCompletionTime: complaint.estimatedCompletionTime,
    history,
    upvoteCount: complaint.upvoteCount || 0,
    upvotes,
    hasUpvoted: viewerId ? upvotes.includes(viewerId) : false,
    feedback: complaint.feedback,
    sla: complaint.sla
      ? {
          ...complaint.sla,
          isOverdue: isTerminalStatus
            ? false
            : Boolean(complaint.sla.isOverdue),
        }
      : complaint.sla,
    aiAnalysis: complaint.aiAnalysis
      ? {
          ...complaint.aiAnalysis,
          suggestedPriority: aiSuggestedPriority,
        }
      : null,
    aiSuggestedDepartment:
      complaint.aiAnalysis?.department ||
      complaint.aiSuggestedDepartment ||
      null,
    aiSuggestion: complaint.aiAnalysis
      ? {
          department: complaint.aiAnalysis.department || null,
          priority: aiSuggestedPriority,
          confidence: complaint.aiAnalysis.confidence ?? null,
          reasoning: complaint.aiAnalysis.reasoning || null,
          sentiment: complaint.aiAnalysis.sentiment || null,
          urgency: complaint.aiAnalysis.urgency || null,
        }
      : null,
  };

  if (!includeAssignment) {
    return base;
  }

  const assignments = complaint.assignedWorkers || [];
  const explicitLeader = hasExplicitLeader(assignments);
  const assignedWorkers = assignments.map((w, index) => ({
    workerId: String(w.workerId?._id || w.workerId?.id || w.workerId || ""),
    workerName: w.workerId?.fullName || w.workerId?.username || null,
    workerPhone: w.workerId?.phone || null,
    taskDescription: w.taskDescription,
    status: w.status,
    assignedAt: w.assignedAt,
    completedAt: w.completedAt,
    isLeader: explicitLeader ? Boolean(w.isLeader) : index === 0,
  }));

  return {
    ...base,
    assignedWorkers,
  };
}

module.exports = {
  buildComplaintView,
  getComplaintTitle,
  normalizeComplaintStatus,
};
