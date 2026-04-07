const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
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

async function syncWorkerRatings(workerIds = []) {
  const normalizedIds = [...new Set(
    workerIds
      .map((workerId) => String(workerId || "").trim())
      .filter(Boolean),
  )];

  if (normalizedIds.length === 0) {
    return {};
  }

  const rows = await Complaint.aggregate([
    { $unwind: "$assignedWorkers" },
    {
      $match: {
        "assignedWorkers.workerId": {
          $in: normalizedIds.map(
            (workerId) => new mongoose.Types.ObjectId(workerId),
          ),
        },
        status: "resolved",
        "feedback.rating": { $gte: 1 },
      },
    },
    {
      $group: {
        _id: "$assignedWorkers.workerId",
        averageRating: { $avg: "$feedback.rating" },
        totalFeedback: { $sum: 1 },
      },
    },
  ]);

  const summaryByWorkerId = rows.reduce((acc, row) => {
    const roundedAverage =
      Math.round((Number(row.averageRating || 0) || 0) * 10) / 10;
    acc[String(row._id)] = {
      averageRating: roundedAverage,
      totalFeedback: Number(row.totalFeedback || 0),
    };
    return acc;
  }, {});

  const bulkOps = normalizedIds.map((workerId) => {
    const summary = summaryByWorkerId[workerId] || {
      averageRating: null,
      totalFeedback: 0,
    };

    return {
      updateOne: {
        filter: { _id: workerId, role: "worker" },
        update: {
          $set: {
            rating: summary.averageRating,
            "performanceMetrics.customerRating": summary.averageRating,
          },
        },
      },
    };
  });

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
  }

  return summaryByWorkerId;
}

async function getWorkerRatingsBulk(workerIds = []) {
  const normalizedIds = [...new Set(
    workerIds
      .map((workerId) => String(workerId || "").trim())
      .filter(Boolean),
  )];

  if (normalizedIds.length === 0) {
    return {};
  }

  const rows = await Complaint.aggregate([
    { $unwind: "$assignedWorkers" },
    {
      $match: {
        "assignedWorkers.workerId": {
          $in: normalizedIds.map(
            (workerId) => new mongoose.Types.ObjectId(workerId),
          ),
        },
        status: "resolved",
        "feedback.rating": { $gte: 1 },
      },
    },
    {
      $group: {
        _id: "$assignedWorkers.workerId",
        averageRating: { $avg: "$feedback.rating" },
        totalFeedback: { $sum: 1 },
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    acc[String(row._id)] = {
      averageRating:
        Math.round((Number(row.averageRating || 0) || 0) * 10) / 10,
      totalFeedback: Number(row.totalFeedback || 0),
    };
    return acc;
  }, {});
}

async function syncWorkerPerformanceMetrics(workerIds = [], now = new Date()) {
  const normalizedIds = [...new Set(
    workerIds
      .map((workerId) => String(workerId || "").trim())
      .filter(Boolean),
  )];

  if (normalizedIds.length === 0) {
    return {};
  }

  const objectIds = normalizedIds.map(
    (workerId) => new mongoose.Types.ObjectId(workerId),
  );
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const rows = await Complaint.aggregate([
    { $unwind: "$assignedWorkers" },
    {
      $match: {
        "assignedWorkers.workerId": { $in: objectIds },
        status: "resolved",
      },
    },
    {
      $project: {
        workerId: "$assignedWorkers.workerId",
        actualCompletionTime: 1,
        createdAt: 1,
        updatedAt: 1,
        resolvedAt: 1,
      },
    },
    {
      $addFields: {
        effectiveResolvedAt: {
          $ifNull: ["$resolvedAt", { $ifNull: ["$updatedAt", "$createdAt"] }],
        },
        computedCompletionHours: {
          $cond: [
            { $gt: ["$actualCompletionTime", 0] },
            "$actualCompletionTime",
            {
              $divide: [
                {
                  $subtract: [
                    { $ifNull: ["$resolvedAt", { $ifNull: ["$updatedAt", "$createdAt"] }] },
                    "$createdAt",
                  ],
                },
                1000 * 60 * 60,
              ],
            },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$workerId",
        totalCompleted: { $sum: 1 },
        currentWeekCompleted: {
          $sum: {
            $cond: [{ $gte: ["$effectiveResolvedAt", weekStart] }, 1, 0],
          },
        },
        averageCompletionTime: { $avg: "$computedCompletionHours" },
      },
    },
  ]);

  const summaryByWorkerId = rows.reduce((acc, row) => {
    acc[String(row._id)] = {
      totalCompleted: Number(row.totalCompleted || 0),
      currentWeekCompleted: Number(row.currentWeekCompleted || 0),
      averageCompletionTime:
        Math.round((Number(row.averageCompletionTime || 0) || 0) * 10) / 10,
    };
    return acc;
  }, {});

  const bulkOps = normalizedIds.map((workerId) => {
    const summary = summaryByWorkerId[workerId] || {
      totalCompleted: 0,
      currentWeekCompleted: 0,
      averageCompletionTime: 0,
    };

    return {
      updateOne: {
        filter: { _id: workerId, role: "worker" },
        update: {
          $set: {
            "performanceMetrics.totalCompleted": summary.totalCompleted,
            "performanceMetrics.currentWeekCompleted":
              summary.currentWeekCompleted,
            "performanceMetrics.averageCompletionTime":
              summary.averageCompletionTime,
          },
        },
      },
    };
  });

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
  }

  return summaryByWorkerId;
}

module.exports = {
  getWorkerMetrics,
  getWorkerMetricsBulk,
  getWorkerRatingsBulk,
  syncWorkerPerformanceMetrics,
  calculateWorkerPerformanceScore,
  syncWorkerRatings,
};
