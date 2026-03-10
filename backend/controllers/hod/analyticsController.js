const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { buildComplaintView } = require("../../utils/complaintView");
const { getHodOrThrow } = require("../../services/accessService");
const { getWorkerMetricsBulk } = require("../../services/workerMetricsService");
const { escapeRegex } = require("./helpers");

exports.getHodOverview = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const { department } = hod;

  const complaints = await Complaint.find({ department })
    .populate("userId", "fullName email phone")
    .populate("assignedWorkers.workerId", "fullName username")
    .sort({ createdAt: -1 });

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
          assigned: {
            $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "in-progress"] }, 1, 0] },
          },
          pendingApproval: {
            $sum: { $cond: [{ $eq: ["$status", "pending-approval"] }, 1, 0] },
          },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
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
          lowPriority: {
            $sum: { $cond: [{ $eq: ["$priority", "Low"] }, 1, 0] },
          },
          totalUpvotes: { $sum: { $ifNull: ["$upvoteCount", 0] } },
          avgFeedbackRating: { $avg: "$feedback.rating" },
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
      return (
        sum +
        (new Date(c.assignedAt) - new Date(c.createdAt)) / (1000 * 60 * 60)
      );
    }, 0);
    avgResponseTime = Math.round(totalResponseTime / assignedComplaints.length);
  }

  const completionRate =
    total > 0 ? Math.round(((resolved + cancelled) / total) * 100) : 0;
  const responseScore = avgResponseTime
    ? Math.max(0, 100 - avgResponseTime * 2)
    : 50;
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
      avgFeedbackRating: complaintStats.avgFeedbackRating
        ? Math.round(complaintStats.avgFeedbackRating * 10) / 10
        : null,
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

  const workerIds = workers.map((worker) => worker._id);
  const metricsByWorkerId = await getWorkerMetricsBulk(workerIds);
  const workersWithMetrics = workers.map((worker) => {
    const metrics = metricsByWorkerId[String(worker._id)] || {
      activeComplaints: 0,
      completedCount: 0,
    };
    return {
      id: worker._id,
      username: worker.username,
      fullName: worker.fullName,
      email: worker.email,
      phone: worker.phone,
      department: worker.department,
      rating: worker.rating,
      activeComplaints: metrics.activeComplaints,
      completedCount: metrics.completedCount,
    };
  });

  return sendSuccess(res, { workers: workersWithMetrics });
});
