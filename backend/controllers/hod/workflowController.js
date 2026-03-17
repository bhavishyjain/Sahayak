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
const {
  applyComplaintTransition,
  broadcastComplaintStatusChange,
} = require("../../services/complaintWorkflowService");
const { ROLES } = require("../../domain/constants");

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

  const resolvedAt = new Date();
  complaint.resolvedAt = resolvedAt;

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

  applyComplaintTransition(complaint, {
    actorRole: ROLES.HEAD,
    actorId: hodId,
    actorLabel: hod.fullName || hod.username || "HOD",
    nextStatus: "resolved",
    note: hodNotes || "Approved by HOD",
    timestamp: resolvedAt,
  });

  await complaint.save();

  await broadcastComplaintStatusChange(complaint, {
    actorId: hodId,
    status: "resolved",
    body: `Complaint #${complaint.ticketId} has been marked as resolved.`,
    includeHeads: false,
  });

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

  complaint.completionPhotos = [];
  complaint.note = reason;
  applyComplaintTransition(complaint, {
    actorRole: ROLES.HEAD,
    actorId: hodId,
    actorLabel: hod.fullName || hod.username || "HOD",
    nextStatus: "needs-rework",
    reason,
  });

  await complaint.save();
  await broadcastComplaintStatusChange(complaint, {
    actorId: hodId,
    status: "needs-rework",
    body: `Complaint #${complaint.ticketId} needs rework: ${reason}`,
    includeHeads: false,
    reason,
  });
  return sendSuccess(
    res,
    { data: complaint },
    "Complaint sent back for rework",
  );
});

exports.cancelComplaint = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { reason } = req.body;
  const hod = await getHodOrThrow(req);
  const hodId = getRequestUserId(req);
  const hodDisplayName =
    hod?.fullName ||
    hod?.username ||
    `HOD (${hod?.department || "Department"})`;
  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
  });

  if (["resolved", "cancelled"].includes(complaint.status)) {
    throw new AppError("Complaint is already finalized", 400);
  }
  const activeWorkers = (complaint.assignedWorkers || []).filter(
    (wa) => wa.status !== "completed",
  );
  if (activeWorkers.length > 0) {
    throw new AppError(
      "Cannot cancel: complaint has active worker assignments",
      400,
    );
  }

  applyComplaintTransition(complaint, {
    actorRole: ROLES.HEAD,
    actorId: hodId,
    actorLabel: hodDisplayName,
    nextStatus: "cancelled",
    reason,
  });

  await complaint.save();
  await broadcastComplaintStatusChange(complaint, {
    actorId: hodId,
    status: "cancelled",
    body: `Complaint #${complaint.ticketId} has been cancelled.`,
    includeHeads: false,
    reason,
  });
  return sendSuccess(
    res,
    { data: complaint },
    "Complaint cancelled successfully",
  );
});

exports.updateWorkerTask = asyncHandler(async (req, res) => {
  const { complaintId, workerId } = req.params;
  const { status, taskDescription } = req.body;
  const hod = await getHodOrThrow(req);

  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
    departmentErrorMessage: "This complaint is not in your department",
  });

  if (status !== undefined) {
    throw new AppError(
      "HOD cannot update worker status from this endpoint",
      400,
    );
  }

  if (taskDescription === undefined) {
    throw new AppError("taskDescription is required", 400);
  }

  const workerTask = complaint.assignedWorkers.find(
    (item) => item.workerId.toString() === workerId,
  );

  if (!workerTask) {
    throw new AppError("Worker not assigned to this complaint", 404);
  }

  const normalizedTaskDescription = String(taskDescription || "").trim();
  workerTask.taskDescription = normalizedTaskDescription || null;

  await complaint.save();
  await broadcastComplaintStatusChange(complaint, {
    actorId: req.user._id,
    status: complaint.status,
    body: `Task details for complaint #${complaint.ticketId} were updated.`,
    includeHeads: false,
    event: "task-updated",
  });

  return sendSuccess(
    res,
    {
      workerTask,
      complaintStatus: complaint.status,
    },
    "Worker task updated successfully",
  );
});
