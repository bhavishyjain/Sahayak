const { buildDetailPayload, buildSummaryPayload } = require("./responseViewService");
const { serializeScheduleHealth } = require("./reportSchedulerService");

function serializeReportStats(stats) {
  return buildSummaryPayload(stats, "stats", { stats });
}

function serializeDepartmentBreakdown(breakdown) {
  return buildSummaryPayload(breakdown, "breakdown", breakdown);
}

function serializeReportSchedule(schedule) {
  const item = serializeScheduleHealth(schedule);
  return buildDetailPayload(item, "schedule", { schedule: item });
}

function serializeReportScheduleList(schedules = []) {
  const items = schedules.map((schedule) => serializeScheduleHealth(schedule));
  return {
    items,
    schedules: items,
  };
}

module.exports = {
  serializeReportStats,
  serializeDepartmentBreakdown,
  serializeReportSchedule,
  serializeReportScheduleList,
};
