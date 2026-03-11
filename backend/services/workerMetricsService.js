const Complaint = require("../models/Complaint");
const { atStartOfToday, atStartOfWeek } = require("../utils/normalize");

function buildMetricsGroupFields(todayStart, weekStart) {
  return {
    totalAssigned: { $sum: 1 },
    activeComplaints: {
      $sum: {
        $cond: [
          { $in: ["$status", ["assigned", "in-progress", "needs-rework"]] },
          1,
          0,
        ],
      },
    },
    completedCount: {
      $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
    },
    completedToday: {
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: ["$status", "resolved"] },
              { $gte: ["$updatedAt", todayStart] },
            ],
          },
          1,
          0,
        ],
      },
    },
    completedThisWeek: {
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: ["$status", "resolved"] },
              { $gte: ["$updatedAt", weekStart] },
            ],
          },
          1,
          0,
        ],
      },
    },
    pendingApproval: {
      $sum: { $cond: [{ $eq: ["$status", "pending-approval"] }, 1, 0] },
    },
  };
}

const EMPTY_METRICS = { activeComplaints: 0, completedCount: 0, completedToday: 0, completedThisWeek: 0, totalAssigned: 0, pendingApproval: 0 };

async function getWorkerMetrics(workerId) {
  try {
    const todayStart = atStartOfToday();
    const weekStart = atStartOfWeek();
    const rows = await Complaint.aggregate([
      { $match: { "assignedWorkers.workerId": workerId } },
      {
        $group: { _id: null, ...buildMetricsGroupFields(todayStart, weekStart) },
      },
    ]);

    const metrics = rows[0] || {};

    return {
      activeComplaints: metrics.activeComplaints || 0,
      completedCount: metrics.completedCount || 0,
      completedToday: metrics.completedToday || 0,
      completedThisWeek: metrics.completedThisWeek || 0,
      totalAssigned: metrics.totalAssigned || 0,
      pendingApproval: metrics.pendingApproval || 0,
    };
  } catch (err) {
    console.error("getWorkerMetrics error:", err);
    return { ...EMPTY_METRICS };
  }
}

async function getWorkerMetricsBulk(workerIds = []) {
  if (!Array.isArray(workerIds) || workerIds.length === 0) {
    return {};
  }

  try {
    const todayStart = atStartOfToday();
    const weekStart = atStartOfWeek();

    const rows = await Complaint.aggregate([
      { $unwind: "$assignedWorkers" },
      { $match: { "assignedWorkers.workerId": { $in: workerIds } } },
      {
        $group: {
          _id: "$assignedWorkers.workerId",
          ...buildMetricsGroupFields(todayStart, weekStart),
        },
      },
    ]);

    return rows.reduce((acc, row) => {
      acc[String(row._id)] = {
        activeComplaints: row.activeComplaints || 0,
        completedCount: row.completedCount || 0,
        completedToday: row.completedToday || 0,
        completedThisWeek: row.completedThisWeek || 0,
        totalAssigned: row.totalAssigned || 0,
        pendingApproval: row.pendingApproval || 0,
      };
      return acc;
    }, {});
  } catch (err) {
    console.error("getWorkerMetricsBulk error:", err);
    return {};
  }
}

function calculateWorkerPerformanceScore(metrics) {
  const totalAssigned = metrics.totalAssigned || 0;
  const completedCount = metrics.completedCount || 0;
  if (totalAssigned === 0) return 0;
  return Math.min(Math.round((completedCount / totalAssigned) * 100), 100);
}

module.exports = {
  getWorkerMetrics,
  getWorkerMetricsBulk,
  calculateWorkerPerformanceScore,
};
