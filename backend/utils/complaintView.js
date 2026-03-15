function getComplaintTitle(complaint) {
  if (complaint?.title) return complaint.title;
  return complaint?.rawText?.split(":")[0] || "Complaint";
}

function normalizeComplaintStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "canceled") return "cancelled";
  return s;
}

function buildComplaintView(complaint, options = {}) {
  const includeAssignment =
    options.includeAssignment === undefined ? true : options.includeAssignment;
  const viewerId = options.currentUserId ? String(options.currentUserId) : null;

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

  const base = {
    id: complaint._id,
    userId: complaint.userId?._id || complaint.userId || null,
    ticketId: complaint.ticketId,
    title: getComplaintTitle(complaint),
    description:
      complaint.refinedText || complaint.rawText || complaint.description,
    department: complaint.department,
    priority: complaint.priority,
    status: normalizeComplaintStatus(complaint.status),
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
    sla: complaint.sla,
  };

  if (!includeAssignment) {
    return base;
  }

  const assignedWorkers = (complaint.assignedWorkers || []).map((w) => ({
    workerId: w.workerId?._id || w.workerId,
    workerName: w.workerId?.fullName || w.workerId?.username || null,
    taskDescription: w.taskDescription,
    status: w.status,
    assignedAt: w.assignedAt,
    completedAt: w.completedAt,
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
