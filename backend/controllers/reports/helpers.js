const User = require("../../models/User");
const AppError = require("../../core/AppError");
const { normalizeStatus, getResolvedAt } = require("../../utils/normalize");
const {
  normalizeString,
  normalizeReportFilters,
  applyNormalizedDateRange,
  normalizeAnalyticsFilters,
  applyAnalyticsDateFilter,
} = require("../../services/filterContractService");

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
    const normalizedFilters = await normalizeReportFilters(input);
    const analyticsFilters = await normalizeAnalyticsFilters(input, {
      allowDepartment: false,
      defaultTimeframe: null,
    });
    if (normalizedFilters.department) {
      filters.department = normalizedFilters.department;
    }
    if (normalizedFilters.status) {
      filters.status = normalizedFilters.status;
    }
    if (normalizedFilters.priority) {
      filters.priority = normalizedFilters.priority;
    }
    applyNormalizedDateRange(filters, normalizedFilters, "createdAt");
    if (!filters.createdAt) {
      applyAnalyticsDateFilter(filters, analyticsFilters, "createdAt");
    }
    return filters;
  }

  const normalizedFilters = await normalizeReportFilters(input, {
    allowDepartment: false,
  });
  const analyticsFilters = await normalizeAnalyticsFilters(input, {
    allowDepartment: false,
    defaultTimeframe: null,
  });
  if (normalizedFilters.status) {
    filters.status = normalizedFilters.status;
  }
  if (normalizedFilters.priority) {
    filters.priority = normalizedFilters.priority;
  }
  applyNormalizedDateRange(filters, normalizedFilters, "createdAt");
  if (!filters.createdAt) {
    applyAnalyticsDateFilter(filters, analyticsFilters, "createdAt");
  }
  return filters;
}

module.exports = {
  normalizeString,
  buildFilters,
  getResolvedAt,
  normalizeStatus,
};
