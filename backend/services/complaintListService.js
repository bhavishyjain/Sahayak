const Complaint = require("../models/Complaint");
const { ROLES } = require("../domain/constants");
const { buildComplaintView } = require("../utils/complaintView");
const { buildListPayload } = require("./responseViewService");
const {
  buildComplaintListQuery,
  normalizeComplaintSort,
  parsePagination,
} = require("./complaintQueryService");

const COMPLAINT_POPULATION_PRESETS = Object.freeze({
  ownerSummary: {
    path: "userId",
    select: "fullName email phone username",
    model: "User",
  },
  ownerBasic: {
    path: "userId",
    select: "fullName username",
    model: "User",
  },
  assignedWorkerSummary: {
    path: "assignedWorkers.workerId",
    select: "fullName username email phone performanceMetrics",
    model: "User",
  },
  assignedWorkerBasic: {
    path: "assignedWorkers.workerId",
    select: "fullName username",
    model: "User",
  },
});

function normalizeScope(scope, fallback = "default") {
  return String(scope || fallback).trim().toLowerCase() || fallback;
}

function applyActorComplaintScope(
  query,
  { actorRole, actorId, actorDepartment, scope } = {},
) {
  const normalizedScope = normalizeScope(scope);

  if (["all", "public", "unrestricted"].includes(normalizedScope)) {
    return normalizedScope;
  }

  if (
    normalizedScope === "department" ||
    normalizedScope === "managed-department"
  ) {
    if (actorDepartment) {
      query.department = actorDepartment;
    }
    return normalizedScope;
  }

  if (
    normalizedScope === "assigned-to-me" ||
    normalizedScope === "worker"
  ) {
    if (actorId) {
      query["assignedWorkers.workerId"] = actorId;
    }
    return normalizedScope;
  }

  if (normalizedScope === "mine" || normalizedScope === "default") {
    if (actorRole === ROLES.USER && actorId) {
      query.userId = actorId;
      return "mine";
    }
    if (actorRole === ROLES.WORKER && actorId) {
      query["assignedWorkers.workerId"] = actorId;
      return "assigned-to-me";
    }
    if (actorRole === ROLES.HEAD && actorDepartment) {
      query.department = actorDepartment;
      return "department";
    }
  }

  return normalizedScope;
}

function applyAssignmentConstraints(query, constraints = {}) {
  const {
    workerId,
    workerIds,
    assignedBy,
    hasAssignments,
    leaderOnly,
  } = constraints;

  if (workerId) {
    query["assignedWorkers.workerId"] = workerId;
  }

  if (Array.isArray(workerIds) && workerIds.length > 0) {
    query["assignedWorkers.workerId"] = { $in: workerIds };
  }

  if (assignedBy) {
    query.assignedBy = assignedBy;
  }

  if (hasAssignments === true) {
    query["assignedWorkers.0"] = { $exists: true };
  } else if (hasAssignments === false) {
    query["assignedWorkers.0"] = { $exists: false };
  }

  if (leaderOnly === true) {
    query["assignedWorkers.isLeader"] = true;
  }
}

function applyStatusConstraints(query, constraints = {}) {
  const {
    statusList,
    statusFilter,
  } = constraints;

  if (Array.isArray(statusList) && statusList.length > 0) {
    query.status = { $in: statusList };
  } else if (statusFilter && typeof statusFilter === "object") {
    query.status = statusFilter;
  }
}

async function buildRoleAwareComplaintListQuery(baseQuery = {}, options = {}) {
  const query = await buildComplaintListQuery(baseQuery, options);

  applyActorComplaintScope(query, {
    actorRole: options.actorRole,
    actorId: options.actorId,
    actorDepartment: options.actorDepartment,
    scope: options.scope,
  });
  applyAssignmentConstraints(query, options.assignmentConstraints);
  applyStatusConstraints(query, options);

  return query;
}

function resolvePopulationEntries(populate = []) {
  const entries = Array.isArray(populate) ? populate : [populate];

  return entries
    .flatMap((entry) => {
      if (!entry) return [];
      if (typeof entry === "string") {
        const preset = COMPLAINT_POPULATION_PRESETS[entry];
        return preset ? [preset] : [];
      }
      return [entry];
    })
    .filter(Boolean);
}

async function executeComplaintListQuery(options = {}) {
  const {
    model = Complaint,
    query = {},
    req = null,
    page: providedPage,
    limit: providedLimit,
    sort = "new-to-old",
    fallbackSort = { createdAt: -1 },
    populate = [],
    select,
    lean = false,
    transform = (item) => item,
    itemKey = "complaints",
    legacy,
  } = options;

  const pagination = req
    ? parsePagination(req)
    : {
        page: Math.max(Number(providedPage) || 1, 1),
        limit: Math.min(Math.max(Number(providedLimit) || 20, 1), 100),
        skip:
          (Math.max(Number(providedPage) || 1, 1) - 1) *
          Math.min(Math.max(Number(providedLimit) || 20, 1), 100),
      };

  let complaintQuery = model
    .find(query)
    .sort(normalizeComplaintSort(sort, fallbackSort))
    .skip(pagination.skip)
    .limit(pagination.limit);

  if (select) {
    complaintQuery = complaintQuery.select(select);
  }

  resolvePopulationEntries(populate).forEach((entry) => {
    complaintQuery = complaintQuery.populate(entry);
  });

  if (lean) {
    complaintQuery = complaintQuery.lean();
  }

  const [rows, total] = await Promise.all([
    complaintQuery,
    model.countDocuments(query),
  ]);

  const items = rows.map(transform);

  return {
    items,
    total,
    page: pagination.page,
    limit: pagination.limit,
    payload: buildListPayload({
      items,
      itemKey,
      page: pagination.page,
      limit: pagination.limit,
      total,
      legacy,
    }),
  };
}

async function listComplaints(options = {}) {
  const {
    baseQuery = {},
    actorRole,
    actorId,
    actorDepartment,
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
    assignmentConstraints,
    statusList,
    statusFilter,
    includeAssignment = true,
    currentUserId,
    ...executionOptions
  } = options;

  const query = await buildRoleAwareComplaintListQuery(baseQuery, {
    actorRole,
    actorId,
    actorDepartment,
    scope,
    status,
    excludeStatus,
    department,
    priority,
    startDate,
    endDate,
    search,
    ticketId,
    dateField,
    validateDepartment,
    validatePriority,
    assignmentConstraints,
    statusList,
    statusFilter,
  });

  return executeComplaintListQuery({
    query,
    transform:
      executionOptions.transform ||
      ((complaint) =>
        buildComplaintView(complaint, {
          includeAssignment,
          currentUserId,
        })),
    ...executionOptions,
  });
}

module.exports = {
  COMPLAINT_POPULATION_PRESETS,
  applyActorComplaintScope,
  applyAssignmentConstraints,
  applyStatusConstraints,
  buildRoleAwareComplaintListQuery,
  executeComplaintListQuery,
  listComplaints,
};
