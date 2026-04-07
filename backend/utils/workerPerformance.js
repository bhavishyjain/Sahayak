const { syncWorkerPerformanceMetrics } = require("../services/workerMetricsService");

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
  await syncWorkerPerformanceMetrics([workerId]);
}

module.exports = {
  calculateCompletionHours,
  updateWorkerCompletionStats,
};
