const AppError = require("../../core/AppError");
const {
  atStartOfToday,
  atStartOfWeek,
} = require("../../services/analyticsMetricsService");

function requireRole(req, allowedRoles, message = "Forbidden") {
  if (!allowedRoles.includes(req.user?.role)) {
    throw new AppError(message, 403);
  }
}

module.exports = {
  atStartOfToday,
  atStartOfWeek,
  requireRole,
};
