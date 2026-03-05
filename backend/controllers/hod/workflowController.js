const Complaint = require("../../models/Complaint");
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
  getHodOrThrow,
  getComplaintOrThrow,
} = require("../../services/accessService");
const { sendComplaintCompleted } = require("../../services/emailService");

exports.approveCompletion = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { hodNotes } = req.body;
  const hod = await getHodOrThrow(req);
  const hodId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
  });

  if (complaint.status !== "pending-approval") {
    throw new AppError("Complaint is not pending approval", 400);
  }

  complaint.status = "resolved";
  complaint.resolvedAt = new Date();

  if (
    complaint.assignedWorkers &&
    complaint.assignedWorkers.length > 0 &&
    complaint.assignedAt
  ) {
    const completionTime = calculateCompletionHours(complaint);
    complaint.actualCompletionTime = completionTime;

    for (const workerAssignment of complaint.assignedWorkers) {
      try {
        await updateWorkerCompletionStats(
          workerAssignment.workerId,
          complaintId,
          completionTime,
        );
      } catch (err) {
        console.error(
          `Failed to update stats for worker ${workerAssignment.workerId}:`,
          err,
        );
      }
    }
  }

  complaint.history.push({
    status: "resolved",
    updatedBy: hodId,
    timestamp: new Date(),
    note: hodNotes || "Approved by HOD",
  });

  await complaint.save();

  try {
    const user = await User.findById(complaint.userId).select(
      "email fullName username",
    );
    if (user && user.email) {
      await sendComplaintCompleted(user.email, user.fullName || user.username, {
        _id: complaint._id,
        ticketId: complaint.ticketId,
        title: complaint.refinedText || complaint.rawText,
        department: complaint.department,
        completedAt: complaint.resolvedAt,
      });
    }
  } catch (emailError) {
    console.error("Failed to send completion email:", emailError);
  }

  return sendSuccess(
    res,
    { data: complaint },
    "Complaint approved and marked as resolved",
  );
});

exports.markNeedsRework = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { reworkReason, rejectionReason } = req.body;
  const reason = reworkReason || rejectionReason;
  if (!reason) {
    throw new AppError("Rework reason is required", 400);
  }

  const hod = await getHodOrThrow(req);
  const hodId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
  });

  if (complaint.status !== "pending-approval") {
    throw new AppError("Complaint is not pending approval", 400);
  }

  complaint.status = "needs-rework";
  complaint.history.push({
    status: "needs-rework",
    updatedBy: hodId,
    timestamp: new Date(),
    note: `Marked as needs-rework by HOD: ${reason}`,
  });

  await complaint.save();
  return sendSuccess(res, { data: complaint }, "Complaint sent back for rework");
});

exports.cancelComplaint = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { reason } = req.body;
  const hod = await getHodOrThrow(req);
  const hodId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
  });

  if (["resolved", "cancelled"].includes(complaint.status)) {
    throw new AppError("Complaint is already finalized", 400);
  }
  if (complaint.assignedWorkers && complaint.assignedWorkers.length > 0) {
    throw new AppError("Only unassigned complaints can be cancelled", 400);
  }

  complaint.status = "cancelled";
  complaint.history.push({
    status: "cancelled",
    updatedBy: hodId,
    timestamp: new Date(),
    note: reason || "Cancelled by HOD",
  });

  await complaint.save();
  return sendSuccess(
    res,
    { data: complaint },
    "Complaint cancelled successfully",
  );
});

exports.updateWorkerTask = asyncHandler(async (req, res) => {
  const { complaintId, workerId } = req.params;
  const { status, notes } = req.body;
  const hod = await getHodOrThrow(req);

  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
    departmentErrorMessage: "This complaint is not in your department",
  });

  const allowedTaskStatuses = [
    "assigned",
    "in-progress",
    "completed",
    "needs-rework",
  ];
  if (status && !allowedTaskStatuses.includes(status)) {
    throw new AppError(
      "Invalid task status. Allowed: assigned, in-progress, completed, needs-rework",
      400,
    );
  }

  const workerTask = complaint.assignedWorkers.find(
    (item) => item.workerId.toString() === workerId,
  );

  if (!workerTask) {
    throw new AppError("Worker not assigned to this complaint", 404);
  }

  workerTask.status = status || workerTask.status;
  workerTask.notes = notes || workerTask.notes;

  if (status === "completed") {
    workerTask.completedAt = new Date();
  }

  const allCompleted = complaint.assignedWorkers.every(
    (item) => item.status === "completed",
  );

  if (allCompleted && complaint.status !== "pending-approval") {
    complaint.status = "pending-approval";
    complaint.history.push({
      status: "pending-approval",
      timestamp: new Date(),
      note: "All assigned workers completed their tasks. Pending HOD approval.",
    });
  }

  await complaint.save();

  return sendSuccess(
    res,
    {
      workerTask,
      complaintStatus: complaint.status,
      allWorkersCompleted: allCompleted,
    },
    "Worker task updated successfully",
  );
});
