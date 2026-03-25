const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { buildComplaintView } = require("../../utils/complaintView");
const {
  getRequestUserId,
  getHodOrThrow,
} = require("../../services/accessService");
const { atStartOfToday, atStartOfWeek } = require("./helpers");
const {
  ANALYTICS_STATUS_BUCKETS,
} = require("../../services/analyticsMetricsService");
const {
  normalizeEnum,
  normalizeAnalyticsFilters,
} = require("../../services/filterContractService");
const { listComplaints } = require("../../services/complaintListService");
const {
  getWorkerDashboardSummary,
  getWorkerAnalyticsSummary,
} = require("../../services/complaintAnalyticsService");
const {
  buildListPayload,
  buildSummaryPayload,
} = require("../../services/responseViewService");

exports.getWorkerOverview = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const [statistics, activePreview] = await Promise.all([
    buildWorkerDashboardSummary(workerId),
    buildWorkerActivePreview(workerId),
  ]);

  return sendSuccess(res, {
    data: {
      assignedComplaints: activePreview,
      completedToday: [],
      statistics,
    },
  });
});

async function buildWorkerDashboardSummary(workerId) {
  return getWorkerDashboardSummary(workerId, {
    todayStart: atStartOfToday(),
    weekStart: atStartOfWeek(),
  });
}

async function buildWorkerActivePreview(workerId, limit = 5) {
  const { items } = await listComplaints({
    actorRole: "worker",
    actorId: workerId,
    scope: "assigned-to-me",
    assignmentConstraints: { workerId },
    statusList: ANALYTICS_STATUS_BUCKETS.workerActionable,
    limit,
    page: 1,
    sort: "priority",
    populate: ["ownerSummary"],
    includeAssignment: true,
    transform: (complaint) => complaint,
  });

  return items;
}

exports.getWorkerDashboardSummary = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const statistics = await buildWorkerDashboardSummary(workerId);
  return sendSuccess(res, buildSummaryPayload(statistics, "statistics", { statistics }));
});

exports.getWorkerActivePreview = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const limit = Math.min(10, Math.max(1, parseInt(req.query.limit, 10) || 5));
  const complaints = await buildWorkerActivePreview(workerId, limit);
  return sendSuccess(
    res,
    buildListPayload({
      items: complaints.map(buildComplaintView),
      itemKey: "complaints",
      page: 1,
      limit,
      total: complaints.length,
      legacy: { hasMore: false },
    }),
  );
});

exports.getAssignedComplaints = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const { payload } = await listComplaints({
    actorRole: req.user?.role,
    actorId: workerId,
    scope: "assigned-to-me",
    assignmentConstraints: { workerId },
    status: req.query.status,
    statusList: req.query.status ? undefined : ANALYTICS_STATUS_BUCKETS.workerOpen,
    dateField: "assignedAt",
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    search: req.query.search,
    priority: req.query.priority,
    department: req.query.department,
    req,
    sort: "assigned-desc",
    populate: ["ownerSummary"],
    includeAssignment: true,
  });

  return sendSuccess(
    res,
    payload,
  );
});

exports.getCompletedComplaints = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const { payload } = await listComplaints({
    actorRole: req.user?.role,
    actorId: workerId,
    scope: "assigned-to-me",
    assignmentConstraints: { workerId },
    status: "resolved",
    dateField: "updatedAt",
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    search: req.query.search,
    priority: req.query.priority,
    department: req.query.department,
    req,
    sort: "updated-desc",
    populate: ["ownerSummary"],
    includeAssignment: true,
  });

  return sendSuccess(
    res,
    payload,
  );
});

exports.getWorkerFeedback = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const complaints = await Complaint.find({
    "assignedWorkers.workerId": workerId,
    status: "resolved",
    "feedback.rating": { $gte: 1 },
  })
    .populate("userId", "fullName username")
    .sort({ updatedAt: -1 })
    .select(
      "ticketId refinedText rawText feedback updatedAt assignedWorkers",
    );

  const feedbackItems = complaints.map((complaint) => ({
    complaintId: String(complaint._id),
    ticketId: complaint.ticketId,
    title:
      complaint.refinedText ||
      complaint.rawText?.split(":")?.[0] ||
      "Complaint",
    rating: Number(complaint.feedback?.rating || 0),
    comment: complaint.feedback?.comment || "",
    ratedAt: complaint.feedback?.ratedAt || complaint.updatedAt,
    citizenName:
      complaint.userId?.fullName || complaint.userId?.username || "Citizen",
  }));

  const totalFeedback = feedbackItems.length;
  const averageRating =
    totalFeedback > 0
      ? Math.round(
          (feedbackItems.reduce((sum, item) => sum + item.rating, 0) /
            totalFeedback) *
            10,
        ) / 10
      : 0;

  return sendSuccess(res, {
    data: {
      summary: {
        averageRating,
        totalFeedback,
      },
      feedback: feedbackItems,
    },
  });
});

exports.getLeaderboard = asyncHandler(async (req, res) => {
  const currentWorkerId = getRequestUserId(req);
  const period = normalizeEnum(
    req.query.period || "monthly",
    ["weekly", "monthly", "yearly"],
    "period",
    { allowAll: false },
  );

  const startDate = new Date();
  if (period === "weekly") startDate.setDate(startDate.getDate() - 7);
  else if (period === "monthly") startDate.setMonth(startDate.getMonth() - 1);
  else if (period === "yearly")
    startDate.setFullYear(startDate.getFullYear() - 1);

  const query = { role: "worker" };
  if (req.user.role === "head") {
    const hod = await getHodOrThrow(req);
    query.department = hod.department;
  } else {
    // Workers always see only their own department
    query.department = req.user.department;
  }

  const workers = await User.find(query).select(
    "fullName username department performanceMetrics rating",
  );

  if (workers.length === 0) {
    return sendSuccess(res, {
      data: { leaderboard: [], currentUser: null, period, totalWorkers: 0 },
    });
  }

  const workerIds = workers.map((w) => w._id);
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  // Single aggregation replaces N×2 countDocuments+find calls
  const aggResults = await Complaint.aggregate([
    {
      $match: {
        status: "resolved",
        updatedAt: { $gte: last30Days },
        "assignedWorkers.workerId": { $in: workerIds },
      },
    },
    { $unwind: "$assignedWorkers" },
    { $match: { "assignedWorkers.workerId": { $in: workerIds } } },
    {
      $group: {
        _id: "$assignedWorkers.workerId",
        periodCompleted: {
          $sum: { $cond: [{ $gte: ["$updatedAt", startDate] }, 1, 0] },
        },
        completionDates: {
          $addToSet: {
            $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" },
          },
        },
      },
    },
  ]);

  // Index by workerId string for O(1) lookup
  const aggMap = new Map(aggResults.map((r) => [String(r._id), r]));

  const leaderboardData = workers.map((worker) => {
    const agg = aggMap.get(String(worker._id)) || {
      periodCompleted: 0,
      completionDates: [],
    };

    // Streak computed from pre-fetched completionDates (no extra DB call)
    let currentStreak = 0;
    if (agg.completionDates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const completionSet = new Set(agg.completionDates);

      const fmt = (d) => d.toISOString().slice(0, 10);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let checkDate = completionSet.has(fmt(today))
        ? new Date(today)
        : completionSet.has(fmt(yesterday))
          ? new Date(yesterday)
          : null;

      while (checkDate && completionSet.has(fmt(checkDate))) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    const metrics = worker.performanceMetrics || {};
    const totalCompleted = metrics.totalCompleted || 0;
    const avgTime = metrics.averageCompletionTime || 0;
    const rating = worker.rating || 0;
    const badges = [];

    if (totalCompleted >= 10 && avgTime > 0 && avgTime <= 24)
      badges.push({
        id: "speed-demon",
        name: "Speed Demon",
        description: "Completes tasks in under 24 hours on average",
        icon: "⚡",
        color: "#F59E0B",
      });
    if (totalCompleted >= 10 && rating >= 4.5)
      badges.push({
        id: "quality-master",
        name: "Quality Master",
        description: "Maintains 4.5+ star rating",
        icon: "⭐",
        color: "#EAB308",
      });
    if (totalCompleted >= 50)
      badges.push({
        id: "community-hero",
        name: "Community Hero",
        description: "Resolved 50+ complaints",
        icon: "🏆",
        color: "#10B981",
      });
    if (totalCompleted >= 100)
      badges.push({
        id: "century-club",
        name: "Century Club",
        description: "Resolved 100+ complaints",
        icon: "💯",
        color: "#8B5CF6",
      });
    if (currentStreak >= 7)
      badges.push({
        id: "consistent-performer",
        name: "Consistent Performer",
        description: "7+ day streak",
        icon: "🔥",
        color: "#EF4444",
      });
    if (agg.periodCompleted >= 20 && period === "monthly")
      badges.push({
        id: "rising-star",
        name: "Rising Star",
        description: "20+ completions this month",
        icon: "🌟",
        color: "#06B6D4",
      });

    return {
      id: worker._id,
      fullName: worker.fullName,
      username: worker.username,
      department: worker.department,
      totalCompleted,
      periodCompleted: agg.periodCompleted,
      averageCompletionTime: avgTime,
      rating,
      currentStreak,
      badges,
      isCurrentUser: String(worker._id) === String(currentWorkerId),
    };
  });

  leaderboardData.sort((a, b) => {
    if (b.periodCompleted !== a.periodCompleted) {
      return b.periodCompleted - a.periodCompleted;
    }
    return b.rating - a.rating;
  });

  leaderboardData.forEach((worker, index) => {
    worker.rank = index + 1;
  });

  return sendSuccess(res, {
    data: {
      leaderboard: leaderboardData,
      currentUser: leaderboardData.find((item) => item.isCurrentUser),
      period,
      totalWorkers: leaderboardData.length,
    },
  });
});

exports.getWorkerAnalytics = asyncHandler(async (req, res) => {
  const isPrivileged = req.user.role === "head" || req.user.role === "admin";
  const analyticsFilters = normalizeAnalyticsFilters(req.query, {
    allowDepartment: false,
    defaultTimeframe: null,
  });
  let workerId;

  if (isPrivileged && req.query.workerId) {
    workerId = req.query.workerId;
  } else {
    workerId = String(req.user._id);
  }

  const analytics = await getWorkerAnalyticsSummary(workerId, analyticsFilters);
  if (!analytics) throw new AppError("Worker not found", 404);

  return sendSuccess(res, analytics);
});
