const User = require("../../models/User");
const AppError = require("../../core/AppError");
const { normalizeStatus, getResolvedAt } = require("../../utils/normalize");

function normalizeString(value) {
  return String(value || "").trim();
}

function parseDateOrThrow(value, fieldName) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return parsed;
}

function appendDateRangeFilter(filters, startDate, endDate) {
  const start = parseDateOrThrow(startDate, "startDate");
  const end = parseDateOrThrow(endDate, "endDate");

  if (!start && !end) return;

  filters.createdAt = {};
  if (start) {
    filters.createdAt.$gte = start;
  }
  if (end) {
    end.setHours(23, 59, 59, 999);
    filters.createdAt.$lte = end;
  }
}

async function buildFilters(req, source = "query") {
  const input = req[source] || {};
  const filters = {};

  if (req.user?.role === "head") {
    const user = await User.findById(req.user._id).select("role department");
    if (!user || user.role !== "head") {
      throw new AppError("Access denied. HOD only.", 403);
    }
    filters.department = user.department;
  } else {
    const department = normalizeString(input.department);
    if (department && department !== "all") {
      filters.department = department;
    }
  }

  const status = normalizeString(input.status);
  if (status && status !== "all") {
    filters.status = status;
  }

  const priority = normalizeString(input.priority);
  if (priority && priority !== "all") {
    filters.priority = priority;
  }

  appendDateRangeFilter(filters, input.startDate, input.endDate);
  return filters;
}

module.exports = {
  normalizeString,
  buildFilters,
  getResolvedAt,
  normalizeStatus,
};
