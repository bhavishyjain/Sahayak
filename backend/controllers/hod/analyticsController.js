const User = require("../../models/User");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { getHodOrThrow } = require("../../services/accessService");
const { getWorkerMetricsBulk } = require("../../services/workerMetricsService");
const { escapeRegex } = require("./helpers");
const {
  ANALYTICS_STATUS_BUCKETS,
} = require("../../services/analyticsMetricsService");
const {
  parsePagination,
} = require("../../services/complaintQueryService");
const {
  normalizeAnalyticsFilters,
} = require("../../services/filterContractService");
const { listComplaints } = require("../../services/complaintListService");
const {
  getHodDashboardStats,
} = require("../../services/complaintAnalyticsService");
const {
  buildDetailPayload,
  buildListPayload,
  buildSummaryPayload,
} = require("../../services/responseViewService");

async function buildHodDashboardStats(department, analyticsFilters = {}) {
  return getHodDashboardStats(department, analyticsFilters);
}

exports.getHodDashboardSummary = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const analyticsFilters = await normalizeAnalyticsFilters(req.query, {
    allowDepartment: false,
    defaultTimeframe: null,
  });
  const stats = await buildHodDashboardStats(hod.department, analyticsFilters);
  return sendSuccess(res, buildSummaryPayload(stats, "stats", { stats }));
});

exports.getHodOverview = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const { department } = hod;
  const analyticsFilters = await normalizeAnalyticsFilters(req.query, {
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
  const { page, limit } = parsePagination(req);
  const normalizedStatusFilter =
    status && !["all", "assigned"].includes(status)
      ? status
      : undefined;
  const { payload } = await listComplaints({
    actorRole: hod.role,
    actorDepartment: department,
    scope: "department",
    baseQuery: { department },
    status:
      analyticsFilters.statusBucket === "resolved"
        ? "resolved"
        : normalizedStatusFilter,
    priority: analyticsFilters.priority ?? req.query.priority,
    search,
    startDate,
    endDate,
    validatePriority: true,
    statusList:
      analyticsFilters.statusBucket && !normalizedStatusFilter
        ? ANALYTICS_STATUS_BUCKETS[analyticsFilters.statusBucket] || []
        : undefined,
    assignmentConstraints: {
      hasAssignments:
        status === "assigned" || assignment === "assigned" ? true : undefined,
    },
    req,
    page,
    limit,
    sort,
    populate: ["ownerSummary", "assignedWorkerBasic"],
    includeAssignment: true,
  });

  return sendSuccess(
    res,
    {
      ...payload,
      pagination: {
        page: payload.page,
        limit: payload.limit,
        total: payload.total,
        totalPages: Math.ceil(payload.total / payload.limit),
      },
    },
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
