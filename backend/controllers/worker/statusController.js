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
const {
  appendCompletionPhotos,
} = require("../../services/completionPhotoService");
const { WORKER_STATUS_TRANSITIONS } = require("./helpers");
const { notifyUser } = require("../notificationController");

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

  complaint.history.push({
    status,
    updatedBy: workerId,
    timestamp: new Date(),
    note: workerNotes || `Status updated to ${status}`,
  });

  await complaint.save();

  const complaintEntityId = String(complaint._id);
  const ticketId = complaint.ticketId;
  const statusLabel = String(status).replace(/-/g, " ");
  const recipientIds = new Set();

  if (complaint.userId) {
    recipientIds.add(String(complaint.userId));
  }

  (complaint.assignedWorkers || []).forEach((assignment) => {
    if (assignment?.workerId) {
      recipientIds.add(String(assignment.workerId));
    }
  });

  if (complaint.department) {
    const heads = await User.find({
      role: "head",
      department: complaint.department,
    }).select("_id");
    heads.forEach((head) => recipientIds.add(String(head._id)));
  }

  recipientIds.delete(String(workerId));

  recipientIds.forEach((recipientId) => {
    notifyUser(recipientId, {
      title: "Complaint Status Updated",
      body: `Complaint #${ticketId} is now ${statusLabel}.`,
      data: {
        type: "complaint-update",
        complaintId: complaintEntityId,
        ticketId,
        status,
      },
    });
  });

  return sendSuccess(
    res,
    { data: complaint },
    "Complaint status updated successfully",
  );
});
