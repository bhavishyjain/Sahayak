const User = require("../../models/User");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const {
  getRequestUserId,
  getHodOrThrow,
  getWorkerOrThrow,
  getComplaintOrThrow,
} = require("../../services/accessService");
const {
  assignComplaintToWorkers,
} = require("../../services/complaintAssignmentService");
const { calculateETA } = require("./helpers");
const {
  parsePagination,
} = require("../../services/complaintQueryService");
const { ANALYTICS_STATUS_BUCKETS } = require("../../services/analyticsMetricsService");
const { listComplaints } = require("../../services/complaintListService");
const {
  buildDetailPayload,
  buildListPayload,
} = require("../../services/responseViewService");

exports.assignMultipleWorkers = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { workers } = req.body; // [{ workerId, taskDescription }]

  if (!Array.isArray(workers) || workers.length === 0) {
    throw new AppError(
      "Workers array is required with at least one worker",
      400,
    );
  }

  const hod = await getHodOrThrow(req);
  const hodId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
  });

  const workerIds = workers.map((item) => item.workerId);
  const validWorkers = await User.find({
    _id: { $in: workerIds },
    role: "worker",
    department: hod.department,
  });

  if (validWorkers.length !== workerIds.length) {
    throw new AppError("Some workers are not in your department", 400);
  }

  const estimatedCompletionTime = validWorkers[0]
    ? await calculateETA(complaint, validWorkers[0])
    : undefined;
  const hodDisplayName =
    hod?.fullName || hod?.username || `HOD (${hod?.department || "Department"})`;
  const assignedWorkerNames = validWorkers
    .map((worker) => worker.fullName || worker.username)
    .join(", ");
  const taskDescriptions = workers.reduce((acc, item) => {
    const id = String(item.workerId || "");
    if (id) acc[id] = item.taskDescription || null;
    return acc;
  }, {});

  const updatedComplaint = await assignComplaintToWorkers({
    complaintId,
    workers,
    assignedBy: hodId,
    estimatedCompletionTime,
    taskDescriptions,
    note: `Assigned to ${validWorkers.length} worker(s) by ${hodDisplayName}: ${assignedWorkerNames}`,
  });

  const complaintView = {
    id: updatedComplaint._id,
    assignedWorkers: updatedComplaint.assignedWorkers,
    status: updatedComplaint.status,
    estimatedCompletionTime: updatedComplaint.estimatedCompletionTime,
  };

  return sendSuccess(
    res,
    buildDetailPayload(complaintView, "complaint", { complaint: complaintView }),
    "Complaint assigned successfully",
  );
});

exports.getWorkerComplaints = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const { workerId } = req.params;
  const { status, search, startDate, endDate } = req.query;
  const { page, limit } = parsePagination(req);

  await getWorkerOrThrow(workerId, {
    department: hod.department,
    departmentErrorMessage: "Worker not found in your department",
  });

  const { payload } = await listComplaints({
    actorRole: hod.role,
    actorDepartment: hod.department,
    scope: "department",
    baseQuery: { department: hod.department },
    assignmentConstraints: { workerId },
    status: status === "completed" ? "resolved" : undefined,
    excludeStatus:
      status === "active" ? "resolved,cancelled,pending-approval" : undefined,
    statusList:
      status === "active" ? ANALYTICS_STATUS_BUCKETS.workerOpen : undefined,
    search,
    startDate,
    endDate,
    dateField: "updatedAt",
    req,
    page,
    limit,
    sort: "updated-desc",
    populate: ["ownerSummary"],
    includeAssignment: true,
  });

  return sendSuccess(
    res,
    payload,
  );
});

exports.getComplaintWorkers = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const hod = await getHodOrThrow(req);

  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
    departmentErrorMessage: "This complaint is not in your department",
  });
  await complaint.populate(
    "assignedWorkers.workerId",
    "fullName username email phone performanceMetrics",
  );

  const workers = (complaint.assignedWorkers || []).map((item) => ({
    workerId: item.workerId,
    taskDescription: item.taskDescription || null,
    status: item.status,
    isLeader: Boolean(item.isLeader),
    assignedAt: item.assignedAt,
    completedAt: item.completedAt,
  }));

  return sendSuccess(
    res,
    buildListPayload({
      items: workers,
      itemKey: "workers",
      page: 1,
      limit: workers.length,
      total: workers.length,
      legacy: { totalWorkers: workers.length },
    }),
    "Workers retrieved successfully",
  );
});
