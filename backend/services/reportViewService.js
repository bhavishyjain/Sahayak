const {
  buildDetailPayload,
  buildListPayload,
  buildSummaryPayload,
} = require("./responseViewService");
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
  return buildListPayload({
    items,
    itemKey: "schedules",
    page: 1,
    limit: Math.max(items.length, 1),
    total: items.length,
  });
}

module.exports = {
  serializeReportStats,
  serializeDepartmentBreakdown,
  serializeReportSchedule,
  serializeReportScheduleList,
};
