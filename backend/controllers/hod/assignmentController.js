const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { buildComplaintView } = require("../../utils/complaintView");
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

exports.assignMultipleWorkers = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { workers } = req.body; // [{ workerId, taskDescription }]

  if (!Array.isArray(workers) || workers.length === 0) {
    throw new AppError("Workers array is required with at least one worker", 400);
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
    note: `Assigned to ${validWorkers.length} worker(s) by HOD: ${validWorkers.map((w) => w.fullName || w.username).join(", ")}`,
  });

  return sendSuccess(
    res,
    {
      complaint: {
        id: updatedComplaint._id,
        assignedWorkers: updatedComplaint.assignedWorkers,
        status: updatedComplaint.status,
        estimatedCompletionTime: updatedComplaint.estimatedCompletionTime,
      },
    },
    "Complaint assigned successfully",
  );
});

exports.getWorkerComplaints = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const { workerId } = req.params;
  const { status } = req.query;

  await getWorkerOrThrow(workerId, {
    department: hod.department,
    departmentErrorMessage: "Worker not found in your department",
  });

  const query = {
    "assignedWorkers.workerId": workerId,
    department: hod.department,
  };
  if (status === "active") {
    query.status = { $in: ["assigned", "in-progress"] };
  } else if (status === "completed") {
    query.status = "resolved";
  }

  const complaints = await Complaint.find(query)
    .populate("userId", "fullName email phone")
    .sort({ updatedAt: -1 });

  const complaintsList = complaints.map((complaint) =>
    buildComplaintView(complaint),
  );
  return sendSuccess(res, {
    complaints: complaintsList,
    total: complaintsList.length,
  });
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

  return sendSuccess(
    res,
    {
      workers: complaint.assignedWorkers,
      totalWorkers: complaint.assignedWorkers.length,
    },
    "Workers retrieved successfully",
  );
});
