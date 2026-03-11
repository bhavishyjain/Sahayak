const User = require("../models/User");

function calculateCompletionHours(complaint) {
  const now = Date.now();
  const startedAt = complaint.assignedAt || complaint.createdAt;
  let completionHours =
    (now - new Date(startedAt).getTime()) / (1000 * 60 * 60);

  if (
    !Number.isFinite(completionHours) ||
    completionHours < 0 ||
    completionHours > 8760
  ) {
    completionHours =
      (now - new Date(complaint.createdAt).getTime()) / (1000 * 60 * 60);
  }

  if (!Number.isFinite(completionHours) || completionHours < 0) {
    completionHours = 1;
  }

  return completionHours;
}

async function updateWorkerCompletionStats(
  workerId,
  complaintId,
  completionHours,
) {
  await User.findByIdAndUpdate(workerId, {
    $inc: {
      "performanceMetrics.totalCompleted": 1,
      "performanceMetrics.currentWeekCompleted": 1,
    },
  });

  const worker = await User.findById(workerId).select("performanceMetrics");
  if (!worker) return;

  const totalCompleted = worker.performanceMetrics?.totalCompleted || 0;
  const currentAvg = worker.performanceMetrics?.averageCompletionTime || 0;

  let newAvg =
    totalCompleted <= 1
      ? completionHours
      : (currentAvg * (totalCompleted - 1) + completionHours) / totalCompleted;

  if (!Number.isFinite(newAvg)) {
    newAvg = completionHours;
  }

  await User.findByIdAndUpdate(workerId, {
    "performanceMetrics.averageCompletionTime": newAvg,
  });
}

module.exports = {
  calculateCompletionHours,
  updateWorkerCompletionStats,
};
