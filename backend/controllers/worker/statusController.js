const User = require("../../models/User");
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
const { appendCompletionPhotos } = require("../../services/completionPhotoService");
const { WORKER_STATUS_TRANSITIONS } = require("./helpers");

exports.updateWorkerStatus = asyncHandler(async (req, res) => {
  const { workerId } = req.params;
  const { workLocation } = req.body;
  const requesterId = String(getRequestUserId(req));

  if (req.user.role !== "admin" && requesterId !== String(workerId)) {
    throw new AppError("You can only update your own status", 403);
  }

  const updateData = { lastActive: new Date() };
  if (workLocation) updateData.workLocation = workLocation;

  const worker = await User.findByIdAndUpdate(workerId, updateData, {
    new: true,
  }).select("-password");

  if (!worker) throw new AppError("Worker not found", 404);
  const workerData = worker.toObject();
  delete workerData.workStatus;
  return sendSuccess(
    res,
    { data: workerData },
    "Worker status updated successfully",
  );
});

exports.updateComplaintStatus = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { status, workerNotes } = req.body;
  const workerId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId);

  const isAssigned = complaint.assignedWorkers?.some(
    (item) => item.workerId.toString() === workerId.toString(),
  );

  if (!isAssigned) {
    throw new AppError("You are not assigned to this complaint", 403);
  }
  const oldStatus = complaint.status;

  if (req.user.role === "worker") {
    const allowedStatuses = WORKER_STATUS_TRANSITIONS[oldStatus] || [];
    if (!allowedStatuses.includes(status)) {
      throw new AppError(
        `Invalid status transition from ${oldStatus} to ${status}`,
        400,
      );
    }
  }

  await appendCompletionPhotos(complaint, req.files || []);

  complaint.status = status;
  if (workerNotes) complaint.workerNotes = workerNotes;

  if (status === "pending-approval") {
    if (!complaint.completionPhotos || complaint.completionPhotos.length === 0) {
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

  complaint.history.push({
    status,
    updatedBy: workerId,
    timestamp: new Date(),
    note: workerNotes || `Status updated to ${status}`,
  });

  await complaint.save();
  return sendSuccess(
    res,
    { data: complaint },
    "Complaint status updated successfully",
  );
});
