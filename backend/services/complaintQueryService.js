const AppError = require("../core/AppError");
const {
  COMPLAINT_DEPARTMENTS,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
} = require("../domain/constants");

const VALID_DEPARTMENTS = COMPLAINT_DEPARTMENTS;
const VALID_PRIORITIES = COMPLAINT_PRIORITIES;
const VALID_STATUSES = COMPLAINT_STATUSES;

function parsePagination(req, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(
    Math.max(Number(req.query.limit) || defaultLimit, 1),
    maxLimit,
  );
  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyDateRangeFilter(query, startDate, endDate, dateField = "createdAt") {
  if (!startDate && !endDate) return;
  query[dateField] = {};
  if (startDate) query[dateField].$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    query[dateField].$lte = end;
  }
}

function applyTextSearchFilter(query, search) {
  const conditions = buildComplaintSearchConditions(search);
  if (conditions.length === 0) return;
  query.$or = conditions;
}

function buildComplaintSearchConditions(search) {
  if (!search || !String(search).trim()) return [];
  const re = new RegExp(escapeRegex(String(search).trim()), "i");
  return [
    { ticketId: re },
    { locationName: re },
    { rawText: re },
    { refinedText: re },
  ];
}

function normalizeEnumValue(value, validValues, errorMessage) {
  if (!value || value === "all") return null;
  const normalized = validValues.find(
    (item) => item.toLowerCase() === String(value).trim().toLowerCase(),
  );
  if (!normalized) {
    throw new AppError(errorMessage, 400);
  }
  return normalized;
}

function applyCommonComplaintFilters(query, options = {}) {
  const {
    status,
    excludeStatus,
    department,
    priority,
    startDate,
    endDate,
    search,
    dateField = "createdAt",
    validateDepartment = false,
    validatePriority = false,
  } = options;

  if (status && status !== "all") {
    query.status = status;
  } else if (excludeStatus) {
    const excludedStatuses = String(excludeStatus)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (excludedStatuses.length > 0) {
      query.status = { $nin: excludedStatuses };
    }
  }

  const normalizedDepartment = validateDepartment
    ? normalizeEnumValue(department, VALID_DEPARTMENTS, "Invalid department filter")
    : department && department !== "all"
      ? department
      : null;
  if (normalizedDepartment) {
    query.department = normalizedDepartment;
  }

  const normalizedPriority = validatePriority
    ? normalizeEnumValue(priority, VALID_PRIORITIES, "Invalid priority filter")
    : priority && priority !== "all"
      ? priority
      : null;
  if (normalizedPriority) {
    query.priority = normalizedPriority;
  }

  applyDateRangeFilter(query, startDate, endDate, dateField);
  applyTextSearchFilter(query, search);
}

function applyTicketIdFilter(query, ticketId) {
  const normalizedTicketId = String(ticketId || "").trim();
  if (!normalizedTicketId) return;
  query.ticketId = normalizedTicketId;
}

function normalizeStatusFilter(status, { allowSpecialStates = [] } = {}) {
  if (!status || status === "all") return null;
  const specialMatch = allowSpecialStates.find(
    (item) => item.toLowerCase() === String(status).trim().toLowerCase(),
  );
  if (specialMatch) return specialMatch;
  return normalizeEnumValue(status, VALID_STATUSES, "Invalid status filter");
}

function normalizeComplaintSort(sort, fallback = { createdAt: -1 }) {
  const sortKey = String(sort || "").trim();
  const sortMap = {
    "new-to-old": { createdAt: -1 },
    "old-to-new": { createdAt: 1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    "updated-desc": { updatedAt: -1 },
    "updated-asc": { updatedAt: 1 },
    priority: { priority: -1, createdAt: -1 },
    "assigned-desc": { assignedAt: -1, createdAt: -1 },
  };
  return sortMap[sortKey] || fallback;
}

function applyComplaintScopeFilter(query, { reqUser, scope = "mine" } = {}) {
  const normalizedScope = String(scope || "mine").trim().toLowerCase();
  if (normalizedScope === "all") {
    if (reqUser?.role === "user") {
      throw new AppError("Forbidden", 403);
    }
    return normalizedScope;
  }

  if (reqUser?._id) {
    query.userId = reqUser._id;
  }
  return "mine";
}

function buildComplaintListQuery(baseQuery = {}, options = {}) {
  const query = { ...baseQuery };
  const {
    reqUser,
    scope,
    status,
    excludeStatus,
    department,
    priority,
    startDate,
    endDate,
    search,
    ticketId,
    dateField = "createdAt",
    validateDepartment = false,
    validatePriority = false,
  } = options;

  if (reqUser) {
    applyComplaintScopeFilter(query, { reqUser, scope });
  }

  applyCommonComplaintFilters(query, {
    status,
    excludeStatus,
    department,
    priority,
    startDate,
    endDate,
    search,
    dateField,
    validateDepartment,
    validatePriority,
  });
  applyTicketIdFilter(query, ticketId);

  return query;
}

module.exports = {
  VALID_DEPARTMENTS,
  VALID_PRIORITIES,
  VALID_STATUSES,
  parsePagination,
  escapeRegex,
  applyDateRangeFilter,
  applyTextSearchFilter,
  buildComplaintSearchConditions,
  applyCommonComplaintFilters,
  applyTicketIdFilter,
  applyComplaintScopeFilter,
  normalizeStatusFilter,
  normalizeComplaintSort,
  buildComplaintListQuery,
  normalizeEnumValue,
};
