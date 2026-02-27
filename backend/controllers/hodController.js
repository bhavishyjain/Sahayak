const Complaint = require("../models/Complaint");
const User = require("../models/User");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const { buildComplaintView } = require("../utils/complaintView");
const {
  calculateCompletionHours,
  updateWorkerCompletionStats,
} = require("../utils/workerPerformance");
const {
  getRequestUserId,
  getHodOrThrow,
  getWorkerOrThrow,
  getComplaintOrThrow,
} = require("../services/accessService");

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function calculateETA(complaint, worker) {
  try {
    const baseHours = { High: 48, Medium: 144, Low: 336 };
    let estimatedHours = baseHours[complaint.priority] || 144;

    const workerAvg = worker.performanceMetrics?.averageCompletionTime;
    if (workerAvg) {
      estimatedHours = (estimatedHours + workerAvg) / 2;
    }

    const similarComplaints = await Complaint.find({
      department: complaint.department,
      priority: complaint.priority,
      status: "resolved",
      actualCompletionTime: { $exists: true, $gt: 0 },
    })
      .sort({ updatedAt: -1 })
      .limit(10);

    if (similarComplaints.length > 0) {
      const avgSimilar =
        similarComplaints.reduce((sum, c) => sum + c.actualCompletionTime, 0) /
        similarComplaints.length;
      estimatedHours = (estimatedHours + avgSimilar) / 2;
    }

    const activeWorkload = await Complaint.countDocuments({
      assignedTo: worker._id,
      status: { $in: ["assigned", "in-progress", "needs-rework"] },
    });

    estimatedHours = estimatedHours * (1 + activeWorkload * 0.2);
    return Math.max(1, Math.round(estimatedHours));
  } catch (error) {
    console.error("ETA calculation error:", error);
    const defaults = { High: 48, Medium: 144, Low: 336 };
    return defaults[complaint.priority] || 144;
  }
}

exports.getHodDashboard = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const { department } = hod;

  const complaints = await Complaint.find({ department })
    .populate("userId", "fullName email phone")
    .populate("assignedTo", "fullName username")
    .sort({ createdAt: -1 })
    .limit(50);

  const complaintsList = complaints.map((complaint) =>
    buildComplaintView(complaint, { includeAssignment: true }),
  );

  const [complaintStatsRows, workerStatsRows] = await Promise.all([
    Complaint.aggregate([
      { $match: { department } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          assigned: { $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] } },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] },
          },
          pendingApproval: {
            $sum: { $cond: [{ $eq: ["$status", "pending-approval"] }, 1, 0] },
          },
          resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
            },
          },
          highPriority: {
            $sum: { $cond: [{ $eq: ["$priority", "High"] }, 1, 0] },
          },
          mediumPriority: {
            $sum: { $cond: [{ $eq: ["$priority", "Medium"] }, 1, 0] },
          },
          lowPriority: { $sum: { $cond: [{ $eq: ["$priority", "Low"] }, 1, 0] } },
          totalUpvotes: { $sum: { $ifNull: ["$upvoteCount", 0] } },
        },
      },
    ]),
    User.aggregate([
      { $match: { role: "worker", department, isActive: true } },
      {
        $group: {
          _id: null,
          totalWorkers: { $sum: 1 },
        },
      },
    ]),
  ]);

  const complaintStats = complaintStatsRows[0] || {};
  const workerStats = workerStatsRows[0] || {};
  const total = complaintStats.total || 0;
  const pending = complaintStats.pending || 0;
  const resolved = complaintStats.resolved || 0;
  const cancelled = complaintStats.cancelled || 0;

  const assignedComplaints = await Complaint.find({
    department,
    assignedAt: { $exists: true },
    createdAt: { $exists: true },
  }).select("createdAt assignedAt");

  let avgResponseTime = null;
  if (assignedComplaints.length > 0) {
    const totalResponseTime = assignedComplaints.reduce((sum, c) => {
      return sum + (new Date(c.assignedAt) - new Date(c.createdAt)) / (1000 * 60 * 60);
    }, 0);
    avgResponseTime = Math.round(totalResponseTime / assignedComplaints.length);
  }

  const completionRate = total > 0 ? Math.round(((resolved + cancelled) / total) * 100) : 0;
  const responseScore = avgResponseTime ? Math.max(0, 100 - avgResponseTime * 2) : 50;
  const pendingPenalty = total > 0 ? (pending / total) * 30 : 0;
  const performanceScore = Math.round(
    completionRate * 0.5 + responseScore * 0.3 + (100 - pendingPenalty) * 0.2,
  );

  return sendSuccess(res, {
    complaints: complaintsList,
    stats: {
      department,
      total,
      pending,
      assigned: complaintStats.assigned || 0,
      inProgress: complaintStats.inProgress || 0,
      pendingApproval: complaintStats.pendingApproval || 0,
      resolved,
      cancelled,
      highPriority: complaintStats.highPriority || 0,
      mediumPriority: complaintStats.mediumPriority || 0,
      lowPriority: complaintStats.lowPriority || 0,
      totalWorkers: workerStats.totalWorkers || 0,
      activeWorkers: workerStats.totalWorkers || 0,
      totalUpvotes: complaintStats.totalUpvotes || 0,
      avgResponseTime,
      performanceScore,
    },
  });
});

exports.getHodWorkers = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const departmentRegex = new RegExp(`^${escapeRegex(hod.department)}$`, "i");
  const workers = await User.find({
    role: "worker",
    department: departmentRegex,
  }).select("-password");

  const workersWithMetrics = await Promise.all(
    workers.map(async (worker) => {
      const [activeComplaints, completedCount] = await Promise.all([
        Complaint.countDocuments({
          assignedTo: worker._id,
          status: { $in: ["assigned", "in-progress", "needs-rework"] },
        }),
        Complaint.countDocuments({
          assignedTo: worker._id,
          status: "resolved",
        }),
      ]);

      return {
        id: worker._id,
        username: worker.username,
        fullName: worker.fullName,
        email: worker.email,
        phone: worker.phone,
        department: worker.department,
        rating: worker.rating,
        activeComplaints,
        completedCount,
      };
    }),
  );

  return sendSuccess(res, { workers: workersWithMetrics });
});

exports.assignComplaintToWorker = asyncHandler(async (req, res) => {
  const { complaintId, workerId } = req.body;
  if (!complaintId || !workerId) {
    throw new AppError("Complaint ID and Worker ID are required", 400);
  }

  const hod = await getHodOrThrow(req);
  const hodId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
  });
  const worker = await getWorkerOrThrow(workerId, {
    department: hod.department,
    departmentErrorMessage: "Worker is not in your department",
  });

  complaint.assignedTo = workerId;
  complaint.assignedBy = hodId;
  complaint.assignedAt = new Date();
  complaint.status = "assigned";
  complaint.estimatedCompletionTime = await calculateETA(complaint, worker);

  complaint.history.push({
    status: "assigned",
    timestamp: new Date(),
    note: `Assigned to ${worker.fullName || worker.username} by HOD. ETA: ${complaint.estimatedCompletionTime} hours`,
  });

  await complaint.save();

  return sendSuccess(
    res,
    {
      complaint: {
        id: complaint._id,
        assignedTo: workerId,
        status: complaint.status,
        estimatedCompletionTime: complaint.estimatedCompletionTime,
      },
    },
    "Complaint assigned successfully",
  );
});

exports.approveCompletion = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { hodNotes } = req.body;
  const hod = await getHodOrThrow(req);
  const hodId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId, { department: hod.department });

  if (complaint.status !== "pending-approval") {
    throw new AppError("Complaint is not pending approval", 400);
  }

  complaint.status = "resolved";

  const workerId = complaint.assignedTo;
  if (workerId && complaint.assignedAt) {
    const completionTime = calculateCompletionHours(complaint);
    complaint.actualCompletionTime = completionTime;
    await updateWorkerCompletionStats(workerId, complaintId, completionTime);
  }

  complaint.history.push({
    status: "resolved",
    updatedBy: hodId,
    timestamp: new Date(),
    note: hodNotes || "Approved by HOD",
  });

  await complaint.save();
  return sendSuccess(res, { data: complaint }, "Complaint approved and marked as resolved");
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
  const complaint = await getComplaintOrThrow(complaintId, { department: hod.department });

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
  const complaint = await getComplaintOrThrow(complaintId, { department: hod.department });

  if (["resolved", "cancelled"].includes(complaint.status)) {
    throw new AppError("Complaint is already finalized", 400);
  }
  if (complaint.assignedTo) {
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
  return sendSuccess(res, { data: complaint }, "Complaint cancelled successfully");
});

exports.bulkAssignComplaints = asyncHandler(async (req, res) => {
  const { complaintIds, workerId } = req.body;
  if (!Array.isArray(complaintIds) || complaintIds.length === 0) {
    throw new AppError("Complaint IDs array is required", 400);
  }
  if (!workerId) {
    throw new AppError("Worker ID is required", 400);
  }

  const hod = await getHodOrThrow(req);
  const hodId = getRequestUserId(req);
  const worker = await getWorkerOrThrow(workerId, {
    department: hod.department,
    departmentErrorMessage: "Worker is not in your department",
  });

  const results = { successful: [], failed: [] };
  for (const complaintId of complaintIds) {
    try {
      const complaint = await Complaint.findById(complaintId);
      if (!complaint) {
        results.failed.push({ complaintId, reason: "Complaint not found" });
        continue;
      }
      if (complaint.department !== hod.department) {
        results.failed.push({ complaintId, reason: "Not in your department" });
        continue;
      }

      complaint.assignedTo = workerId;
      complaint.assignedBy = hodId;
      complaint.assignedAt = new Date();
      complaint.status = "assigned";
      complaint.estimatedCompletionTime = await calculateETA(complaint, worker);
      complaint.history.push({
        status: "assigned",
        updatedBy: hodId,
        timestamp: new Date(),
        note: `Bulk assigned to ${worker.fullName || worker.username} by HOD`,
      });
      await complaint.save();
      results.successful.push({ complaintId, ticketId: complaint.ticketId });
    } catch (error) {
      results.failed.push({ complaintId, reason: error.message });
    }
  }

  return sendSuccess(
    res,
    { data: results },
    `Assigned ${results.successful.length} out of ${complaintIds.length} complaints`,
  );
});

exports.getWorkerComplaints = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const { workerId } = req.params;
  const { status } = req.query;

  await getWorkerOrThrow(workerId, {
    department: hod.department,
    departmentErrorMessage: "Worker not found in your department",
  });

  const query = { assignedTo: workerId };
  if (status === "active") {
    query.status = { $in: ["assigned", "in-progress"] };
  } else if (status === "completed") {
    query.status = "resolved";
  }

  const complaints = await Complaint.find(query)
    .populate("userId", "fullName email phone")
    .sort({ updatedAt: -1 });

  const complaintsList = complaints.map((complaint) => buildComplaintView(complaint));
  return sendSuccess(res, { complaints: complaintsList, total: complaintsList.length });
});
