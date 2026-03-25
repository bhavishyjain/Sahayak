const Complaint = require("../models/Complaint");
const User = require("../models/User");
const { calculateAvgResponseTimeHours } = require("../utils/normalize");
const {
  ANALYTICS_STATUS_BUCKETS,
} = require("./analyticsMetricsService");
const {
  applyAnalyticsComplaintFilters,
} = require("./filterContractService");

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
  getHodDashboardStats,
  buildWorkerComplaintAnalytics,
  buildComplaintFiltersForWorker,
  buildComplaintFiltersForDepartment,
  ANALYTICS_STATUS_BUCKETS,
};
