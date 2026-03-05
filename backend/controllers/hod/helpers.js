const Complaint = require("../../models/Complaint");

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function calculateETA(complaint, worker) {
  try {
    const baseHours = { High: 48, Medium: 144, Low: 336 };
    let estimatedHours = baseHours[complaint.priority] || 144;

    const workerAvg = worker.performanceMetrics?.averageCompletionTime;
    if (workerAvg) {
      estimatedHours = (estimatedHours + workerAvg) / 2;
    }

    const similarComplaints = await Complaint.find({
      department: complaint.department,
      priority: complaint.priority,
      status: "resolved",
      actualCompletionTime: { $exists: true, $gt: 0 },
    })
      .sort({ updatedAt: -1 })
      .limit(10);

    if (similarComplaints.length > 0) {
      const avgSimilar =
        similarComplaints.reduce((sum, c) => sum + c.actualCompletionTime, 0) /
        similarComplaints.length;
      estimatedHours = (estimatedHours + avgSimilar) / 2;
    }

    const activeWorkload = await Complaint.countDocuments({
      "assignedWorkers.workerId": worker._id,
      status: { $in: ["assigned", "in-progress", "needs-rework"] },
    });

    estimatedHours = estimatedHours * (1 + activeWorkload * 0.2);
    return Math.max(1, Math.round(estimatedHours));
  } catch (error) {
    console.error("ETA calculation error:", error);
    const defaults = { High: 48, Medium: 144, Low: 336 };
    return defaults[complaint.priority] || 144;
  }
}

module.exports = {
  escapeRegex,
  calculateETA,
};
