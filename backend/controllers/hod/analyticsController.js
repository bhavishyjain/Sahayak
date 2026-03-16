const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { buildComplaintView } = require("../../utils/complaintView");
const { getHodOrThrow } = require("../../services/accessService");
const { getWorkerMetricsBulk } = require("../../services/workerMetricsService");
const { escapeRegex } = require("./helpers");
const { calculateAvgResponseTimeHours } = require("../../utils/normalize");
const {
  ANALYTICS_STATUS_BUCKETS,
} = require("../../services/analyticsMetricsService");
const {
  buildComplaintListQuery,
  normalizeComplaintSort,
  parsePagination,
} = require("../../services/complaintQueryService");
const {
  normalizeAnalyticsFilters,
} = require("../../services/filterContractService");
const {
  buildDetailPayload,
  buildListPayload,
  buildSummaryPayload,
} = require("../../services/responseViewService");

async function buildHodDashboardStats(department, analyticsFilters = {}) {
  const complaintMatch = { department };
  if (analyticsFilters.priority) {
    complaintMatch.priority = analyticsFilters.priority;
  }
  if (analyticsFilters.statusBucket) {
    complaintMatch.status = {
      $in: ANALYTICS_STATUS_BUCKETS[analyticsFilters.statusBucket] || [],
    };
  }
  if (analyticsFilters.dateRange?.startDate || analyticsFilters.dateRange?.endDate) {
    complaintMatch.createdAt = {};
    if (analyticsFilters.dateRange.startDate) {
      complaintMatch.createdAt.$gte = analyticsFilters.dateRange.startDate;
    }
    if (analyticsFilters.dateRange.endDate) {
      const inclusiveEnd = new Date(analyticsFilters.dateRange.endDate);
      inclusiveEnd.setHours(23, 59, 59, 999);
      complaintMatch.createdAt.$lte = inclusiveEnd;
    }
  }

  const [complaintStatsRows, workerStatsRows, assignedComplaints] =
    await Promise.all([
      Complaint.aggregate([
        { $match: complaintMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
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
      Complaint.find({
        ...complaintMatch,
        assignedAt: { $exists: true },
      }).select("createdAt assignedAt"),
    ]);

  const complaintStats = complaintStatsRows[0] || {};
  const workerStats = workerStatsRows[0] || {};
  const total = complaintStats.total || 0;
  const pending = complaintStats.pending || 0;
  const resolved = complaintStats.resolved || 0;
  const cancelled = complaintStats.cancelled || 0;
  const avgResponseTime = calculateAvgResponseTimeHours(assignedComplaints);
  const completionRate =
    total > 0 ? Math.round(((resolved + cancelled) / total) * 100) : 0;
  const responseScore = avgResponseTime
    ? Math.max(0, 100 - avgResponseTime * 2)
    : 50;
  const pendingPenalty = total > 0 ? (pending / total) * 30 : 0;
  const performanceScore = Math.round(
    completionRate * 0.5 + responseScore * 0.3 + (100 - pendingPenalty) * 0.2,
  );

  return {
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
  };
}

exports.getHodDashboardSummary = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const analyticsFilters = normalizeAnalyticsFilters(req.query, {
    allowDepartment: false,
    defaultTimeframe: null,
  });
  const stats = await buildHodDashboardStats(hod.department, analyticsFilters);
  return sendSuccess(res, buildSummaryPayload(stats, "stats", { stats }));
});

exports.getHodOverview = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const { department } = hod;
  const analyticsFilters = normalizeAnalyticsFilters(req.query, {
    allowDepartment: false,
    defaultTimeframe: null,
  });
  const {
    status,
    search,
    startDate,
    endDate,
    sort = "new-to-old",
    assignment = "all",
  } = req.query;
  const { page, limit, skip } = parsePagination(req);
  const normalizedStatusFilter =
    status && !["all", "assigned"].includes(status)
      ? status
      : undefined;
  const complaintQuery = buildComplaintListQuery(
    { department },
    {
      status:
        analyticsFilters.statusBucket === "resolved"
          ? "resolved"
          : normalizedStatusFilter,
      excludeStatus: undefined,
      priority: analyticsFilters.priority ?? req.query.priority,
      search,
      startDate,
      endDate,
      validatePriority: true,
    },
  );

  if (analyticsFilters.statusBucket && !normalizedStatusFilter) {
    complaintQuery.status = {
      $in: ANALYTICS_STATUS_BUCKETS[analyticsFilters.statusBucket] || [],
    };
  }

  if (status && status !== "all") {
    if (status === "assigned") {
      complaintQuery["assignedWorkers.0"] = { $exists: true };
    }
  }

  if (assignment === "assigned") {
    complaintQuery["assignedWorkers.0"] = { $exists: true };
  }

  const [complaints, complaintsTotal] = await Promise.all([
    Complaint.find(complaintQuery)
      .populate("userId", "fullName email phone")
      .populate("assignedWorkers.workerId", "fullName username")
      .sort(normalizeComplaintSort(sort))
      .skip(skip)
      .limit(limit),
    Complaint.countDocuments(complaintQuery),
  ]);

  const complaintsList = complaints.map((complaint) =>
    buildComplaintView(complaint, { includeAssignment: true }),
  );

  return sendSuccess(
    res,
    buildListPayload({
      items: complaintsList,
      itemKey: "complaints",
      page,
      limit,
      total: complaintsTotal,
      legacy: {
        pagination: {
          page,
          limit,
          total: complaintsTotal,
          totalPages: Math.ceil(complaintsTotal / limit),
        },
      },
    }),
  );
});

exports.getHodWorkers = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const departmentRegex = new RegExp(`^${escapeRegex(hod.department)}$`, "i");
  const { search } = req.query;
  const { page, limit, skip } = parsePagination(req);
  const query = {
    role: "worker",
    department: departmentRegex,
  };

  if (search && search.trim()) {
    const re = new RegExp(escapeRegex(search.trim()), "i");
    query.$or = [
      { fullName: re },
      { username: re },
      { email: re },
      { phone: re },
    ];
  }

  const [workers, total] = await Promise.all([
    User.find(query)
      .select("-password")
      .sort({ fullName: 1, username: 1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(query),
  ]);

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

  return sendSuccess(
    res,
    buildListPayload({
      items: workersWithMetrics,
      itemKey: "workers",
      page,
      limit,
      total,
      legacy: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    }),
  );
});

exports.getHodWorkerById = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const departmentRegex = new RegExp(`^${escapeRegex(hod.department)}$`, "i");
  const { workerId } = req.params;

  const worker = await User.findOne({
    _id: workerId,
    role: "worker",
    department: departmentRegex,
  }).select("-password");

  if (!worker) {
    throw new (require("../../core/AppError"))("Worker not found", 404);
  }

  const metricsByWorkerId = await getWorkerMetricsBulk([worker._id]);
  const metrics = metricsByWorkerId[String(worker._id)] || {
    activeComplaints: 0,
    completedCount: 0,
  };

  const workerView = {
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

  return sendSuccess(res, buildDetailPayload(workerView, "worker", { worker: workerView }));
});
