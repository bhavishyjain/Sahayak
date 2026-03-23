const AppError = require("../core/AppError");
const {
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} = require("../domain/constants");
const { getDepartmentNames } = require("./departmentService");
const {
  ANALYTICS_STATUS_BUCKETS,
  getTimeframeWindowStart,
} = require("./analyticsMetricsService");

const ANALYTICS_TIMEFRAMES = Object.freeze(["7days", "30days", "3months", "6months"]);
const REPORT_FORMATS = Object.freeze(["pdf", "excel", "csv"]);
const REPORT_FREQUENCIES = Object.freeze(["daily", "weekly", "monthly"]);
const ANALYTICS_SCOPE_VALUES = Object.freeze(["mine", "all"]);
const ANALYTICS_BUCKET_ALIASES = Object.freeze({
  open: "backlog",
  all: null,
});

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

function normalizeEnum(value, validValues, fieldName, { allowAll = true } = {}) {
  const normalized = normalizeString(value);
  if (!normalized || (allowAll && normalized === "all")) return null;
  const match = validValues.find(
    (item) => item.toLowerCase() === normalized.toLowerCase(),
  );
  if (!match) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return match;
}

function normalizeDateRange({ startDate, endDate, fieldNamePrefix = "" } = {}) {
  const start = parseDateOrThrow(startDate, `${fieldNamePrefix}startDate`.trim());
  const end = parseDateOrThrow(endDate, `${fieldNamePrefix}endDate`.trim());
  if (start && end && start > end) {
    throw new AppError("startDate cannot be after endDate", 400);
  }
  return { startDate: start, endDate: end };
}

function applyNormalizedDateRange(query, dateRange, dateField = "createdAt") {
  const { startDate, endDate } = dateRange || {};
  if (!startDate && !endDate) return;
  query[dateField] = {};
  if (startDate) {
    query[dateField].$gte = startDate;
  }
  if (endDate) {
    const inclusiveEnd = new Date(endDate);
    inclusiveEnd.setHours(23, 59, 59, 999);
    query[dateField].$lte = inclusiveEnd;
  }
}

function normalizeAnalyticsScope(value, { defaultScope = "mine" } = {}) {
  return normalizeEnum(
    value || defaultScope,
    ANALYTICS_SCOPE_VALUES,
    "scope",
    { allowAll: false },
  );
}

function normalizeAnalyticsBucket(value, { defaultBucket = "all" } = {}) {
  const normalized = normalizeString(value || defaultBucket || "all").toLowerCase();
  const aliased = ANALYTICS_BUCKET_ALIASES[normalized] ?? normalized;
  if (!aliased) return null;
  if (aliased === "all") return null;
  if (!Object.prototype.hasOwnProperty.call(ANALYTICS_STATUS_BUCKETS, aliased)) {
    throw new AppError("Invalid analytics bucket", 400);
  }
  return aliased;
}

async function normalizeAnalyticsFilters(
  input = {},
  { allowDepartment = true, defaultTimeframe = "30days", defaultScope = "mine" } = {},
) {
  const departmentNames = allowDepartment ? await getDepartmentNames() : [];
  const timeframe = defaultTimeframe
    ? normalizeEnum(
        input.timeframe || defaultTimeframe,
        ANALYTICS_TIMEFRAMES,
        "timeframe",
        { allowAll: false },
      )
    : input.timeframe
      ? normalizeEnum(input.timeframe, ANALYTICS_TIMEFRAMES, "timeframe", {
          allowAll: false,
        })
      : null;
  const priority = normalizeEnum(
    input.priority,
    COMPLAINT_PRIORITIES,
    "priority",
  );
  const department = allowDepartment
    ? normalizeEnum(input.department, departmentNames, "department")
    : null;
  const dateRange = normalizeDateRange({
    startDate: input.startDate,
    endDate: input.endDate,
  });
  return {
    timeframe,
    priority,
    department,
    scope: normalizeAnalyticsScope(input.scope, { defaultScope }),
    statusBucket: normalizeAnalyticsBucket(input.bucket),
    granularity: normalizeString(input.granularity) || "cluster",
    dateRange,
  };
}

function applyAnalyticsDateFilter(query, filters = {}, dateField = "createdAt") {
  if (filters?.dateRange?.startDate || filters?.dateRange?.endDate) {
    applyNormalizedDateRange(query, filters.dateRange, dateField);
    return;
  }
  if (filters?.timeframe) {
    query[dateField] = {
      ...(query[dateField] || {}),
      $gte: getTimeframeWindowStart(filters.timeframe),
    };
  }
}

function applyAnalyticsComplaintFilters(query, filters = {}, dateField = "createdAt") {
  if (filters.department) {
    query.department = filters.department;
  }
  if (filters.priority) {
    query.priority = filters.priority;
  }
  if (filters.statusBucket) {
    query.status = { $in: ANALYTICS_STATUS_BUCKETS[filters.statusBucket] || [] };
  }
  applyAnalyticsDateFilter(query, filters, dateField);
}

async function normalizeReportFilters(input = {}, { allowDepartment = true } = {}) {
  const departmentNames = allowDepartment ? await getDepartmentNames() : [];
  return {
    department: allowDepartment
      ? normalizeEnum(input.department, departmentNames, "department")
      : null,
    status: normalizeEnum(input.status, COMPLAINT_STATUSES, "status"),
    priority: normalizeEnum(input.priority, COMPLAINT_PRIORITIES, "priority"),
    ...normalizeDateRange({
      startDate: input.startDate,
      endDate: input.endDate,
    }),
  };
}

function normalizeSchedulePolicy(input = {}) {
  const email = normalizeString(input.email).toLowerCase();
  if (!email) {
    throw new AppError("Email is required", 400);
  }
  const frequency = normalizeEnum(
    input.frequency,
    REPORT_FREQUENCIES,
    "frequency",
    { allowAll: false },
  );
  const format = normalizeEnum(input.format || "pdf", REPORT_FORMATS, "format", {
    allowAll: false,
  });
  const hour = Number(input.hour ?? 9);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new AppError("Invalid hour", 400);
  }

  return {
    email,
    frequency,
    format,
    hour,
  };
}

module.exports = {
  ANALYTICS_TIMEFRAMES,
  REPORT_FORMATS,
  REPORT_FREQUENCIES,
  normalizeString,
  parseDateOrThrow,
  normalizeEnum,
  normalizeDateRange,
  applyNormalizedDateRange,
  normalizeAnalyticsScope,
  normalizeAnalyticsBucket,
  normalizeAnalyticsFilters,
  applyAnalyticsDateFilter,
  applyAnalyticsComplaintFilters,
  normalizeReportFilters,
  normalizeSchedulePolicy,
};
