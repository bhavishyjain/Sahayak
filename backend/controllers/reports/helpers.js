const User = require("../../models/User");
const AppError = require("../../core/AppError");

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

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "in progress") return "in-progress";
  if (normalized === "canceled") return "cancelled";
  return normalized;
}

function getResolvedAt(complaint) {
  if (complaint?.resolvedAt) return new Date(complaint.resolvedAt);
  const resolvedEvent = (complaint?.history || [])
    .filter((event) => normalizeStatus(event?.status) === "resolved")
    .sort(
      (a, b) =>
        new Date(b?.timestamp || 0).getTime() -
        new Date(a?.timestamp || 0).getTime(),
    )[0];
  return resolvedEvent?.timestamp ? new Date(resolvedEvent.timestamp) : null;
}

module.exports = {
  normalizeString,
  buildFilters,
  getResolvedAt,
};
