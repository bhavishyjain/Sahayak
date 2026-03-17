function normalizeAssignedWorker(worker = {}) {
  return {
    ...worker,
    workerId: String(worker.workerId || ""),
    workerName: worker.workerName || null,
    isLeader: Boolean(worker.isLeader),
  };
}

export function mapComplaintDetailViewModel(complaint = {}) {
  if (!complaint) return null;

  return {
    ...complaint,
    id: String(complaint.id || complaint._id || ""),
    userId: String(complaint.userId || complaint.ownerId || ""),
    ownerId: String(complaint.ownerId || complaint.userId || ""),
    ownerName: complaint.ownerName || null,
    title: complaint.title || "Complaint",
    description: complaint.description || "",
    assignedWorkers: Array.isArray(complaint.assignedWorkers)
      ? complaint.assignedWorkers.map(normalizeAssignedWorker)
      : [],
    proofImage: Array.isArray(complaint.proofImage)
      ? complaint.proofImage
      : complaint.proofImage
        ? [complaint.proofImage]
        : [],
    completionPhotos: Array.isArray(complaint.completionPhotos)
      ? complaint.completionPhotos
      : [],
    history: Array.isArray(complaint.history) ? complaint.history : [],
    upvotes: Array.isArray(complaint.upvotes)
      ? complaint.upvotes.map((value) => String(value))
      : [],
    feedback: complaint.feedback || null,
    sla: complaint.sla || null,
    aiAnalysis: complaint.aiAnalysis || null,
    aiSuggestedDepartment:
      complaint.aiSuggestedDepartment ||
      complaint.aiSuggestion?.department ||
      null,
    aiSuggestion: complaint.aiSuggestion || null,
  };
}
