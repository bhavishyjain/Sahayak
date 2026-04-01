const User = require("../models/User");
const AppError = require("../core/AppError");
const {
  normalizeString,
  normalizeReportFilters,
  applyNormalizedDateRange,
  normalizeAnalyticsFilters,
  applyAnalyticsDateFilter,
  normalizeSchedulePolicy,
} = require("./filterContractService");

function normalizeTimeZone(
  value,
  fallback = process.env.REPORT_SCHEDULE_TIMEZONE || "Asia/Kolkata",
) {
  const timeZone = normalizeString(value || fallback);
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch (_error) {
    throw new AppError("Invalid timezone", 400);
  }
}

function getCronExpressionForFrequency(frequency, hour = 9) {
  const safeHour = Math.max(0, Math.min(23, Number(hour) || 9));
  if (frequency === "daily") return `0 ${safeHour} * * *`;
  if (frequency === "weekly") return `0 ${safeHour} * * 1`;
  if (frequency === "monthly") return `0 ${safeHour} 1 * *`;
  return null;
}

async function buildReportFiltersForRequest(req, source = "query") {
  const input = req[source] || {};
  const filters = {};

  if (req.user?.role === "head") {
    const user = await User.findById(req.user._id).select("role department");
    if (!user || user.role !== "head") {
      throw new AppError("Access denied. HOD only.", 403);
    }
    filters.department = user.department;
  } else {
    const normalizedFilters = await normalizeReportFilters(input);
    const analyticsFilters = normalizeAnalyticsFilters(input, {
      allowDepartment: false,
      defaultTimeframe: null,
    });
    if (normalizedFilters.department) filters.department = normalizedFilters.department;
    if (normalizedFilters.status) filters.status = normalizedFilters.status;
    if (normalizedFilters.priority) filters.priority = normalizedFilters.priority;
    applyNormalizedDateRange(filters, normalizedFilters, "createdAt");
    if (!filters.createdAt) {
      applyAnalyticsDateFilter(filters, analyticsFilters, "createdAt");
    }
    return filters;
  }

  const normalizedFilters = await normalizeReportFilters(input, {
    allowDepartment: false,
  });
  const analyticsFilters = normalizeAnalyticsFilters(input, {
    allowDepartment: false,
    defaultTimeframe: null,
  });
  if (normalizedFilters.status) filters.status = normalizedFilters.status;
  if (normalizedFilters.priority) filters.priority = normalizedFilters.priority;
  applyNormalizedDateRange(filters, normalizedFilters, "createdAt");
  if (!filters.createdAt) {
    applyAnalyticsDateFilter(filters, analyticsFilters, "createdAt");
  }
  return filters;
}

function buildSchedulePolicy(req, filters = {}) {
  const input = req.body || {};
  const requestedDepartment = normalizeString(input.department);
  const { email, frequency, format, hour } = normalizeSchedulePolicy(input);
  const timezone = normalizeTimeZone(input.timezone);
  const cronExpression = getCronExpressionForFrequency(frequency, hour);

  if (!cronExpression) {
    throw new AppError("Invalid schedule frequency", 400);
  }

  const department =
    req.user?.role === "admin" && requestedDepartment && requestedDepartment !== "all"
      ? requestedDepartment
      : normalizeString(filters.department) || "all";

  return {
    email,
    frequency,
    format,
    hour,
    timezone,
    cronExpression,
    department,
    filters: {
      ...filters,
      ...(normalizeString(input.rangePreset)
        ? { rangePreset: normalizeString(input.rangePreset) }
        : {}),
    },
  };
}

function buildActiveScheduleLookup({
  userId,
  email,
  frequency,
  format,
  department,
}) {
  return {
    userId,
    email,
    frequency,
    format,
    department,
    isActive: true,
  };
}

function assertScheduleCanRunNow(schedule, { isRunning = false } = {}) {
  if (!schedule) {
    throw new AppError("Schedule not found", 404);
  }
  if (!schedule.isActive) {
    throw new AppError("Schedule is inactive", 409);
  }
  if (isRunning) {
    throw new AppError("Schedule is already running", 409);
  }
}

module.exports = {
  normalizeTimeZone,
  getCronExpressionForFrequency,
  buildReportFiltersForRequest,
  buildSchedulePolicy,
  buildActiveScheduleLookup,
  assertScheduleCanRunNow,
};
