const {
  ACTIVE_COMPLAINT_STATUSES,
} = require("../domain/constants");

const ANALYTICS_STATUS_BUCKETS = Object.freeze({
  active: ACTIVE_COMPLAINT_STATUSES,
  backlog: ["pending", "assigned", "in-progress", "pending-approval", "needs-rework"],
  workerActionable: ["assigned", "in-progress", "needs-rework", "pending-approval"],
  workerOpen: ["assigned", "in-progress", "needs-rework"],
  final: ["resolved", "cancelled"],
  resolved: ["resolved"],
  pendingApproval: ["pending-approval"],
});

function atStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function atStartOfWeek() {
  const date = atStartOfToday();
  const day = date.getDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setDate(date.getDate() - diff);
  return date;
}

function monthsAgoStart(monthsAgo) {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getTimeframeWindowStart(timeframe = "30days") {
  const windowStart = new Date();
  switch (String(timeframe || "30days")) {
    case "7days":
      windowStart.setDate(windowStart.getDate() - 7);
      break;
    case "3months":
      windowStart.setMonth(windowStart.getMonth() - 3);
      break;
    case "6months":
      windowStart.setMonth(windowStart.getMonth() - 6);
      break;
    case "30days":
    default:
      windowStart.setDate(windowStart.getDate() - 30);
      break;
  }
  return windowStart;
}

module.exports = {
  ANALYTICS_STATUS_BUCKETS,
  atStartOfToday,
  atStartOfWeek,
  monthsAgoStart,
  getTimeframeWindowStart,
};
