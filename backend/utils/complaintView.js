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

  const base = {
    id: complaint._id,
    ticketId: complaint.ticketId,
    title: getComplaintTitle(complaint),
    description: complaint.refinedText || complaint.rawText || complaint.description,
    department: complaint.department,
    priority: complaint.priority,
    status: normalizeComplaintStatus(complaint.status),
    locationName: complaint.locationName,
    coordinates: complaint.coordinates,
    proofImage: complaint.proofImage,
    completionPhotos: complaint.completionPhotos || [],
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    assignedAt: complaint.assignedAt,
    estimatedCompletionTime: complaint.estimatedCompletionTime,
    history: (complaint.history || []).map((item) => ({
      ...item,
      status: normalizeComplaintStatus(item?.status),
    })),
    upvoteCount: complaint.upvoteCount || 0,
    upvotes: (complaint.upvotes || []).map((id) => String(id)),
    feedback: complaint.feedback,
    sla: complaint.sla,
  };

  if (!includeAssignment) {
    return base;
  }

  return {
    ...base,
    assignedTo: complaint.assignedTo?._id || complaint.assignedTo || null,
    assignedWorkerName: complaint.assignedTo?.fullName || null,
  };
}

module.exports = {
  buildComplaintView,
  getComplaintTitle,
  normalizeComplaintStatus,
};
