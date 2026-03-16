const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const {
  calculateCompletionHours,
  updateWorkerCompletionStats,
} = require("../../utils/workerPerformance");
const {
  getRequestUserId,
  getComplaintOrThrow,
} = require("../../services/accessService");
const {
  appendCompletionPhotos,
} = require("../../services/completionPhotoService");
const {
  applyComplaintTransition,
  broadcastComplaintStatusChange,
} = require("../../services/complaintWorkflowService");
const { ROLES } = require("../../domain/constants");

exports.updateComplaintStatus = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { status } = req.body;
  const workerId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId);

  const isAssigned = complaint.assignedWorkers?.some(
    (item) => item.workerId.toString() === workerId.toString(),
  );

  if (!isAssigned) {
    throw new AppError("You are not assigned to this complaint", 403);
  }
  const oldStatus = complaint.status;

  await appendCompletionPhotos(complaint, req.files || []);

  if (status === "pending-approval") {
    if (
      !complaint.completionPhotos ||
      complaint.completionPhotos.length === 0
    ) {
      throw new AppError(
        "Completion photos are required when submitting for approval",
        400,
      );
    }
  }

  if (status === "resolved" && oldStatus !== "resolved") {
    complaint.resolvedAt = new Date();
    const completionTime = calculateCompletionHours(complaint);
    complaint.actualCompletionTime = completionTime;
    await updateWorkerCompletionStats(workerId, complaintId, completionTime);
  } else if (oldStatus === "resolved" && status !== "resolved") {
    complaint.resolvedAt = null;
  }

  applyComplaintTransition(complaint, {
    actorRole: ROLES.WORKER,
    actorId: workerId,
    actorLabel: req.user?.fullName || req.user?.username || "Worker",
    nextStatus: status,
  });

  await complaint.save();

  const ticketId = complaint.ticketId;
  const statusLabel = String(status).replace(/-/g, " ");
  await broadcastComplaintStatusChange(complaint, {
    actorId: workerId,
    status,
    body: `Complaint #${ticketId} is now ${statusLabel}.`,
    includeHeads: true,
  });

  return sendSuccess(
    res,
    { data: complaint },
    "Complaint status updated successfully",
  );
});
