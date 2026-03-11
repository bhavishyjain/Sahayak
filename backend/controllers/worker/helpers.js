const AppError = require("../../core/AppError");
const { atStartOfToday, atStartOfWeek } = require("../../utils/normalize");

const WORKER_STATUS_TRANSITIONS = {
  assigned: ["in-progress", "pending-approval"],
  "in-progress": ["pending-approval"],
  "needs-rework": ["in-progress", "pending-approval"],
};

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
