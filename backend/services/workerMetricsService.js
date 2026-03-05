const Complaint = require("../models/Complaint");

function atStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function atStartOfWeek() {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}

async function getWorkerMetrics(workerId) {
  const todayStart = atStartOfToday();
  const weekStart = atStartOfWeek();
  const rows = await Complaint.aggregate([
    { $match: { "assignedWorkers.workerId": workerId } },
    {
      $group: {
        _id: null,
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
      },
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
}

async function getWorkerMetricsBulk(workerIds = []) {
  if (!Array.isArray(workerIds) || workerIds.length === 0) {
    return {};
  }

  const todayStart = atStartOfToday();
  const weekStart = atStartOfWeek();

  const rows = await Complaint.aggregate([
    { $unwind: "$assignedWorkers" },
    {
      $match: {
        "assignedWorkers.workerId": { $in: workerIds },
      },
    },
    {
      $group: {
        _id: "$assignedWorkers.workerId",
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
