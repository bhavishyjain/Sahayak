const AppError = require("../../core/AppError");

const WORKER_STATUS_TRANSITIONS = {
  assigned: ["in-progress", "pending-approval"],
  "in-progress": ["pending-approval"],
  "needs-rework": ["in-progress", "pending-approval"],
};

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

function requireRole(req, allowedRoles, message = "Forbidden") {
  if (!allowedRoles.includes(req.user?.role)) {
    throw new AppError(message, 403);
  }
}

module.exports = {
  WORKER_STATUS_TRANSITIONS,
  atStartOfToday,
  atStartOfWeek,
  requireRole,
};
