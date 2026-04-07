const Complaint = require("../models/Complaint");
const User = require("../models/User");
const { calculateAvgResponseTimeHours } = require("../utils/normalize");
const {
  ANALYTICS_STATUS_BUCKETS,
} = require("./analyticsMetricsService");
const {
  applyAnalyticsComplaintFilters,
} = require("./filterContractService");
const { getWorkerRatingsBulk } = require("./workerMetricsService");

const STATUS_KEYS = Object.freeze([
  "pending",
  "assigned",
  "in-progress",
  "pending-approval",
  "resolved",
  "needs-rework",
  "cancelled",
]);

const PRIORITY_KEYS = Object.freeze(["Low", "Medium", "High"]);
const ANALYTICS_CONTRACT_VERSION = 1;
const TROPHY_DEFINITIONS = Object.freeze({
  "speed-demon": {
    id: "speed-demon",
    name: "Speed Demon",
    description: "Completes tasks in under 24 hours on average",
  },
  "quality-master": {
    id: "quality-master",
    name: "Quality Master",
    description: "Maintains 4.5+ star rating",
  },
  "community-hero": {
    id: "community-hero",
    name: "Community Hero",
    description: "Resolved 50+ complaints",
  },
  "century-club": {
    id: "century-club",
    name: "Century Club",
    description: "Resolved 100+ complaints",
  },
  "consistent-performer": {
    id: "consistent-performer",
    name: "Consistent Performer",
    description: "7+ day streak",
  },
  "rising-star": {
    id: "rising-star",
    name: "Rising Star",
    description: "20+ completions this month",
  },
});

function getResolvedDate(complaint) {
  return complaint?.resolvedAt || complaint?.updatedAt || complaint?.createdAt;
}

function getMonthStart(date) {
  const value = new Date(date);
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function getNextMonthStart(date) {
  const value = new Date(date);
  return new Date(value.getFullYear(), value.getMonth() + 1, 1, 0, 0, 0, 0);
}

function getCompletionHours(complaint) {
  const start = complaint?.createdAt ? new Date(complaint.createdAt) : null;
  const end = getResolvedDate(complaint);
  if (!start || !end) return null;
  const durationMs = new Date(end).getTime() - start.getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  return durationMs / (1000 * 60 * 60);
}

function getAverageResolvedCompletionHours(complaints = []) {
  const durations = complaints
    .map((complaint) => {
      if (Number.isFinite(complaint?.actualCompletionTime)) {
        return Number(complaint.actualCompletionTime);
      }
      return getCompletionHours(complaint);
    })
    .filter((value) => Number.isFinite(value) && value >= 0);

  if (durations.length === 0) return 0;
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}

function getCurrentWorkerBadgeIds(resolvedComplaints = [], asOfDate = new Date()) {
  const sorted = [...resolvedComplaints]
    .filter((complaint) => {
      const resolvedAt = getResolvedDate(complaint);
      return resolvedAt && new Date(resolvedAt) <= new Date(asOfDate);
    })
    .sort((a, b) => new Date(getResolvedDate(a)) - new Date(getResolvedDate(b)));

  let resolvedCount = 0;
  let completionHoursSum = 0;
  let completionHoursCount = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  const monthlyCounts = new Map();
  const earnedIds = new Set();

  sorted.forEach((complaint) => {
    const resolvedAt = getResolvedDate(complaint);
    resolvedCount += 1;

    const completionHours = getCompletionHours(complaint);
    if (Number.isFinite(completionHours) && completionHours >= 0) {
      completionHoursSum += completionHours;
      completionHoursCount += 1;
    }

    const rating = Number(complaint?.feedback?.rating || 0);
    if (rating >= 1) {
      ratingSum += rating;
      ratingCount += 1;
    }

    const runningAvgCompletion =
      completionHoursCount > 0 ? completionHoursSum / completionHoursCount : null;
    const runningAvgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

    if (resolvedCount >= 10 && runningAvgCompletion !== null && runningAvgCompletion <= 24) {
      earnedIds.add("speed-demon");
    }
    if (resolvedCount >= 10 && runningAvgRating !== null && runningAvgRating >= 4.5) {
      earnedIds.add("quality-master");
    }
    if (resolvedCount >= 50) {
      earnedIds.add("community-hero");
    }
    if (resolvedCount >= 100) {
      earnedIds.add("century-club");
    }

    const monthKey = new Date(resolvedAt).toISOString().slice(0, 7);
    const monthCount = (monthlyCounts.get(monthKey) || 0) + 1;
    monthlyCounts.set(monthKey, monthCount);
    if (monthCount >= 20) {
      earnedIds.add("rising-star");
    }
  });

  const uniqueDays = [...new Set(
    sorted.map((complaint) => new Date(getResolvedDate(complaint)).toISOString().slice(0, 10)),
  )]
    .sort();

  let streak = 0;
  let previousDate = null;
  uniqueDays.forEach((dayKey) => {
    const current = new Date(`${dayKey}T00:00:00.000Z`);
    if (!previousDate) {
      streak = 1;
    } else {
      const diffDays = Math.round(
        (current.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      streak = diffDays === 1 ? streak + 1 : 1;
    }
    if (streak >= 7) {
      earnedIds.add("consistent-performer");
    }
    previousDate = current;
  });

  return [...earnedIds];
}

function buildWorkerTrophyHistory(resolvedComplaints = []) {
  const sorted = [...resolvedComplaints]
    .filter((complaint) => getResolvedDate(complaint))
    .sort((a, b) => new Date(getResolvedDate(a)) - new Date(getResolvedDate(b)));

  const earned = [];
  const earnedIds = new Set();

  sorted.forEach((complaint, index) => {
    const resolvedAt = getResolvedDate(complaint);
    const currentBadgeIds = getCurrentWorkerBadgeIds(
      sorted.slice(0, index + 1),
      resolvedAt,
    );

    currentBadgeIds.forEach((id) => {
      if (!id || earnedIds.has(id)) return;
      const definition = TROPHY_DEFINITIONS[id];
      if (!definition) return;
      earnedIds.add(id);
      earned.push({
        ...definition,
        earnedAt: getNextMonthStart(resolvedAt),
        qualifyingMonth: getMonthStart(resolvedAt),
      });
    });
  });

  return earned.sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));
}

function summarizeWorkerTrophies(resolvedComplaints = []) {
  const trophyHistory = buildWorkerTrophyHistory(resolvedComplaints);
  const currentBadgeIds = getCurrentWorkerBadgeIds(resolvedComplaints);
  const currentBadges = currentBadgeIds
    .map((id) => TROPHY_DEFINITIONS[id])
    .filter(Boolean);

  return {
    currentBadges,
    trophyHistory,
    trophyCount: trophyHistory.length,
  };
}

function buildCountMap(rows = [], fallbackKeys = [], fallbackKey = "unknown") {
  const counts = fallbackKeys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  rows.forEach((row) => {
    const key = row?._id || fallbackKey;
    counts[key] = Number(row?.count || 0);
  });

  return counts;
}

function buildDepartmentBreakdownObject(rows = []) {
  const seeded = {};

  rows.forEach((row) => {
    const department = row?._id || "Other";
    seeded[department] = {
      total: Number(row?.total || 0),
      pending: Number(row?.pending || 0),
      assigned: Number(row?.assigned || 0),
      inProgress: Number(row?.inProgress || 0),
      pendingApproval: Number(row?.pendingApproval || 0),
      needsRework: Number(row?.needsRework || 0),
      resolved: Number(row?.resolved || 0),
      cancelled: Number(row?.cancelled || 0),
      highPriority: Number(row?.highPriority || 0),
      mediumPriority: Number(row?.mediumPriority || 0),
      lowPriority: Number(row?.lowPriority || 0),
    };
  });

  return seeded;
}

async function getComplaintMetricSnapshot(filters = {}) {
  const [statusRows, priorityRows, departmentRows, resolutionRows, total] =
    await Promise.all([
      Complaint.aggregate([
        { $match: filters },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Complaint.aggregate([
        { $match: filters },
        {
          $project: {
            normalizedPriority: {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: [{ $toLower: { $ifNull: ["$priority", ""] } }, "high"],
                    },
                    then: "High",
                  },
                  {
                    case: {
                      $eq: [{ $toLower: { $ifNull: ["$priority", ""] } }, "medium"],
                    },
                    then: "Medium",
                  },
                  {
                    case: {
                      $eq: [{ $toLower: { $ifNull: ["$priority", ""] } }, "low"],
                    },
                    then: "Low",
                  },
                ],
                default: "Low",
              },
            },
          },
        },
        { $group: { _id: "$normalizedPriority", count: { $sum: 1 } } },
      ]),
      Complaint.aggregate([
        { $match: filters },
        { $group: { _id: "$department", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Complaint.aggregate([
        {
          $match: {
            ...filters,
            resolvedAt: { $ne: null },
            createdAt: { $ne: null },
          },
        },
        {
          $project: {
            resolutionHours: {
              $divide: [
                { $subtract: ["$resolvedAt", "$createdAt"] },
                1000 * 60 * 60,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgResolutionTime: { $avg: "$resolutionHours" },
          },
        },
      ]),
      Complaint.countDocuments(filters),
    ]);

  return {
    total,
    byStatus: buildCountMap(statusRows, STATUS_KEYS),
    byPriority: buildCountMap(priorityRows, PRIORITY_KEYS),
    byDepartment: buildCountMap(departmentRows, [], "Other"),
    departmentRows: (departmentRows || [])
      .filter((row) => row?._id)
      .map((row) => ({
        department: row._id,
        count: Number(row.count || 0),
      })),
    avgResolutionTime: Math.round(resolutionRows[0]?.avgResolutionTime || 0),
  };
}

function buildMonthlyTrend(monthlyData = [], months = 6) {
  const monthlyTrend = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const found = monthlyData.find(
      (row) => row?._id?.year === year && row?._id?.month === month,
    );
    monthlyTrend.push({ year, month, count: found?.count || 0 });
  }
  return monthlyTrend;
}

async function getCitizenAnalyticsSummary({ userId, filters = {} } = {}) {
  const complaintFilters = { userId };
  applyAnalyticsComplaintFilters(complaintFilters, filters, "createdAt");
  const trendStart = complaintFilters.createdAt?.$gte || new Date(new Date().setMonth(new Date().getMonth() - 5, 1));

  const [snapshot, recentComplaints, monthlyData] = await Promise.all([
    getComplaintMetricSnapshot(complaintFilters),
    Complaint.find(complaintFilters)
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "ticketId rawText refinedText department priority status locationName createdAt",
      ),
    Complaint.aggregate([
      { $match: { ...complaintFilters, createdAt: { $gte: trendStart } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  return {
    contractVersion: ANALYTICS_CONTRACT_VERSION,
    stats: {
      total: snapshot.total || 0,
      pending: snapshot.byStatus.pending || 0,
      assigned: snapshot.byStatus.assigned || 0,
      inProgress: snapshot.byStatus["in-progress"] || 0,
      resolved: snapshot.byStatus.resolved || 0,
    },
    avgResolutionTime: snapshot.avgResolutionTime || null,
    mostActiveDepartment: snapshot.departmentRows[0]?.department || null,
    departmentBreakdown: snapshot.departmentRows,
    monthlyTrend: buildMonthlyTrend(monthlyData, 6),
    recent: recentComplaints,
  };
}

async function getComplaintDepartmentBreakdown(filters = {}) {
  const rows = await Complaint.aggregate([
    { $match: filters },
    {
      $group: {
        _id: { $ifNull: ["$department", "Other"] },
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
        needsRework: {
          $sum: { $cond: [{ $eq: ["$status", "needs-rework"] }, 1, 0] },
        },
        resolved: {
          $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
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
      },
    },
    { $sort: { total: -1, _id: 1 } },
  ]);

  return buildDepartmentBreakdownObject(rows);
}

async function getHodDashboardStats(department, analyticsFilters = {}) {
  const complaintFilters = { department };
  applyAnalyticsComplaintFilters(complaintFilters, analyticsFilters, "createdAt");

  const [
    snapshot,
    workerRows,
    assignedComplaints,
    upvoteRows,
    feedbackRows,
  ] = await Promise.all([
    getComplaintMetricSnapshot(complaintFilters),
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
      ...complaintFilters,
      assignedAt: { $exists: true },
    }).select("createdAt assignedAt"),
    Complaint.aggregate([
      { $match: complaintFilters },
      {
        $group: {
          _id: null,
          totalUpvotes: { $sum: { $ifNull: ["$upvoteCount", 0] } },
        },
      },
    ]),
    Complaint.aggregate([
      {
        $match: {
          ...complaintFilters,
          status: "resolved",
          "feedback.rating": { $gte: 1 },
        },
      },
      {
        $group: {
          _id: null,
          avgFeedbackRating: { $avg: "$feedback.rating" },
        },
      },
    ]),
  ]);

  const total = snapshot.total || 0;
  const pending = snapshot.byStatus.pending || 0;
  const resolved = snapshot.byStatus.resolved || 0;
  const cancelled = snapshot.byStatus.cancelled || 0;
  const avgResponseTime = calculateAvgResponseTimeHours(assignedComplaints);
  const completionRate =
    total > 0 ? Math.round(((resolved + cancelled) / total) * 100) : 0;
  const responseScore = avgResponseTime
    ? Math.max(0, 100 - avgResponseTime * 2)
    : 50;
  const pendingPenalty = total > 0 ? (pending / total) * 30 : 0;

  return {
    contractVersion: ANALYTICS_CONTRACT_VERSION,
    department,
    total,
    pending,
    assigned: snapshot.byStatus.assigned || 0,
    inProgress: snapshot.byStatus["in-progress"] || 0,
    pendingApproval: snapshot.byStatus["pending-approval"] || 0,
    needsRework: snapshot.byStatus["needs-rework"] || 0,
    resolved,
    cancelled,
    highPriority: snapshot.byPriority.High || 0,
    mediumPriority: snapshot.byPriority.Medium || 0,
    lowPriority: snapshot.byPriority.Low || 0,
    totalWorkers: Number(workerRows[0]?.totalWorkers || 0),
    activeWorkers: Number(workerRows[0]?.totalWorkers || 0),
    totalUpvotes: Number(upvoteRows[0]?.totalUpvotes || 0),
    avgResponseTime,
    avgFeedbackRating: (() => {
      const value = feedbackRows[0]?.avgFeedbackRating;
      return value ? Math.round(value * 10) / 10 : null;
    })(),
    performanceScore: Math.round(
      completionRate * 0.5 + responseScore * 0.3 + (100 - pendingPenalty) * 0.2,
    ),
  };
}

async function getWorkerDashboardSummary(workerId, { todayStart, weekStart } = {}) {
  const today = todayStart || (() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  })();
  const week = weekStart || (() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setDate(date.getDate() - diff);
    return date;
  })();

  const filters = { "assignedWorkers.workerId": workerId };
  const [snapshot, weekCompleted, completedToday] = await Promise.all([
    getComplaintMetricSnapshot(filters),
    Complaint.countDocuments({
      ...filters,
      status: "resolved",
      updatedAt: { $gte: week },
    }),
    Complaint.countDocuments({
      ...filters,
      status: "resolved",
      updatedAt: { $gte: today },
    }),
  ]);

  return {
    contractVersion: ANALYTICS_CONTRACT_VERSION,
    totalCompleted: snapshot.byStatus.resolved || 0,
    totalAssigned: snapshot.total || 0,
    completedToday,
    weekCompleted,
    activeComplaints:
      (snapshot.byStatus.assigned || 0) +
      (snapshot.byStatus["in-progress"] || 0) +
      (snapshot.byStatus["needs-rework"] || 0) +
      (snapshot.byStatus["pending-approval"] || 0),
    pendingApproval: snapshot.byStatus["pending-approval"] || 0,
  };
}

function buildWorkerComplaintAnalytics(complaints = []) {
  const resolved = complaints.filter((complaint) => complaint.status === "resolved");
  const priorityBreakdown = PRIORITY_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});
  const statusDistribution = STATUS_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  complaints.forEach((complaint) => {
    if (complaint.priority && priorityBreakdown[complaint.priority] !== undefined) {
      priorityBreakdown[complaint.priority] += 1;
    }
    if (complaint.status && statusDistribution[complaint.status] !== undefined) {
      statusDistribution[complaint.status] += 1;
    }
  });

  return {
    total: complaints.length,
    resolved,
    completionRate:
      complaints.length > 0
        ? Math.round((resolved.length / complaints.length) * 100)
        : 0,
    priorityBreakdown,
    statusDistribution,
  };
}

async function getWorkerAnalyticsSummary(workerId, analyticsFilters = {}) {
  const filters = buildComplaintFiltersForWorker(workerId, analyticsFilters);
  const [worker, allComplaints, ratingsByWorkerId] = await Promise.all([
    User.findById(workerId)
      .select("fullName department specializations rating performanceMetrics")
      .lean(),
    Complaint.find(filters, {
      status: 1,
      priority: 1,
      resolvedAt: 1,
      updatedAt: 1,
      createdAt: 1,
      feedback: 1,
    }).lean(),
    getWorkerRatingsBulk([workerId]),
  ]);

  if (!worker) return null;

  const analytics = buildWorkerComplaintAnalytics(allComplaints);
  const resolvedComplaints = allComplaints.filter(
    (complaint) => complaint?.status === "resolved",
  );
  const trophySummary = summarizeWorkerTrophies(resolvedComplaints);
  const ratingSummary = ratingsByWorkerId[String(workerId)] || null;
  const liveAverageCompletionHours =
    getAverageResolvedCompletionHours(resolvedComplaints);
  const now = new Date();
  const weeklyTrend = [];
  for (let i = 7; i >= 0; i--) {
    const wEnd = new Date(now);
    wEnd.setDate(now.getDate() - i * 7);
    wEnd.setHours(23, 59, 59, 999);
    const wStart = new Date(wEnd);
    wStart.setDate(wEnd.getDate() - 6);
    wStart.setHours(0, 0, 0, 0);
    const count = analytics.resolved.filter((c) => {
      const d = new Date(c.resolvedAt || c.updatedAt);
      return d >= wStart && d <= wEnd;
    }).length;
    weeklyTrend.push({
      label: wStart.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      }),
      count,
    });
  }

  return {
    contractVersion: ANALYTICS_CONTRACT_VERSION,
    worker: {
      fullName: worker.fullName,
      department: worker.department,
      specializations: worker.specializations || [],
      rating:
        ratingSummary?.averageRating ??
        (Number.isFinite(worker.rating) ? worker.rating : null),
      performanceMetrics: worker.performanceMetrics || {},
    },
    summary: {
      totalAssigned: analytics.total,
      totalCompleted: analytics.resolved.length,
      completionRate: analytics.completionRate,
      avgCompletionTime: liveAverageCompletionHours,
      weekCompleted: worker.performanceMetrics?.currentWeekCompleted || 0,
      customerRating: Number.isFinite(worker.performanceMetrics?.customerRating)
        ? worker.performanceMetrics.customerRating
        : null,
    },
    achievements: {
      currentBadges: trophySummary.currentBadges,
      trophyHistory: trophySummary.trophyHistory,
      trophyCount: trophySummary.trophyCount,
    },
    weeklyTrend,
    priorityBreakdown: analytics.priorityBreakdown,
    statusDistribution: analytics.statusDistribution,
  };
}

function buildComplaintFiltersForWorker(workerId, analyticsFilters = {}) {
  const filters = {
    "assignedWorkers.workerId": workerId,
  };
  applyAnalyticsComplaintFilters(filters, analyticsFilters, "createdAt");
  return filters;
}

function buildComplaintFiltersForDepartment(department, analyticsFilters = {}) {
  const filters = {
    department,
  };
  applyAnalyticsComplaintFilters(filters, analyticsFilters, "createdAt");
  return filters;
}

module.exports = {
  STATUS_KEYS,
  PRIORITY_KEYS,
  getComplaintMetricSnapshot,
  getComplaintDepartmentBreakdown,
  getCitizenAnalyticsSummary,
  getHodDashboardStats,
  getWorkerDashboardSummary,
  getWorkerAnalyticsSummary,
  buildWorkerTrophyHistory,
  summarizeWorkerTrophies,
  buildWorkerComplaintAnalytics,
  buildComplaintFiltersForWorker,
  buildComplaintFiltersForDepartment,
  ANALYTICS_STATUS_BUCKETS,
  ANALYTICS_CONTRACT_VERSION,
};
