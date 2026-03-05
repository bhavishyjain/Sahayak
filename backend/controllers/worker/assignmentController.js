const User = require("../../models/User");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const {
  getWorkerOrThrow,
  getHodOrThrow,
} = require("../../services/accessService");
const { createUserAccount } = require("../../services/userProvisionService");
const { getWorkerMetricsBulk } = require("../../services/workerMetricsService");
const { requireRole } = require("./helpers");

exports.createWorker = asyncHandler(async (req, res) => {
  requireRole(req, ["admin"], "Only admins can create workers");

  const {
    username,
    password,
    fullName,
    email,
    phone,
    department,
    specializations,
  } = req.body;
  if (!username || !password || !department || !fullName || !email || !phone) {
    throw new AppError(
      "Username, password, fullName, email, phone, and department are required",
      400,
    );
  }

  const worker = await createUserAccount({
    username,
    password,
    fullName,
    email,
    phone,
    department,
    role: "worker",
    specializations: specializations || [],
  });

  const workerResponse = worker.toObject();
  delete workerResponse.password;

  return sendSuccess(
    res,
    { data: workerResponse },
    "Worker created successfully",
    201,
  );
});

exports.updateWorker = asyncHandler(async (req, res) => {
  requireRole(req, ["admin"], "Only admins can update workers");
  const { workerId } = req.params;
  const { fullName, email, phone, department, specializations } = req.body;
  const worker = await getWorkerOrThrow(workerId);

  if (fullName) worker.fullName = fullName;
  if (email) worker.email = email;
  if (phone) worker.phone = phone;
  if (department) worker.department = department;
  if (specializations) worker.specializations = specializations;
  await worker.save();

  const workerResponse = worker.toObject();
  delete workerResponse.password;

  return sendSuccess(
    res,
    { data: workerResponse },
    "Worker updated successfully",
  );
});

exports.getAllWorkers = asyncHandler(async (req, res) => {
  const { department } = req.query;
  const filter = { role: "worker" };
  if (req.user.role === "head") {
    const hod = await getHodOrThrow(req);
    filter.department = hod.department;
  } else if (department && department !== "all") {
    filter.department = department;
  }

  const workers = await User.find(filter)
    .select("-password")
    .populate("assignedComplaints", "ticketId status priority createdAt")
    .populate("completedComplaints", "ticketId status completedAt");

  const metricsByWorkerId = await getWorkerMetricsBulk(
    workers.map((worker) => worker._id),
  );

  const workersWithMetrics = workers.map((worker) => ({
    ...worker.toObject(),
    metrics: metricsByWorkerId[String(worker._id)] || {
      activeComplaints: 0,
      completedCount: 0,
      completedToday: 0,
      completedThisWeek: 0,
      totalAssigned: 0,
      pendingApproval: 0,
    },
  }));

  return sendSuccess(res, { data: workersWithMetrics });
});

exports.getAvailableWorkers = asyncHandler(async (req, res) => {
  const { department: requestedDepartment } = req.params;
  let department = requestedDepartment;
  if (req.user.role === "head") {
    const hod = await getHodOrThrow(req);
    if (
      requestedDepartment &&
      requestedDepartment !== hod.department &&
      requestedDepartment !== "all"
    ) {
      throw new AppError("You can only view workers from your department", 403);
    }
    department = hod.department;
  }
  const matchStage = {
    role: "worker",
    isActive: true,
  };
  if (department && department !== "all") {
    matchStage.department = department;
  }
  const availableWorkers = await User.aggregate([
    {
      $match: matchStage,
    },
    {
      $lookup: {
        from: "complaints",
        let: { workerId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ["$$workerId", "$assignedWorkers.workerId"] },
                  {
                    $in: [
                      "$status",
                      ["assigned", "in-progress", "needs-rework"],
                    ],
                  },
                ],
              },
            },
          },
        ],
        as: "activeComplaints",
      },
    },
    { $addFields: { activeComplaintCount: { $size: "$activeComplaints" } } },
    { $project: { password: 0, activeComplaints: 0 } },
    { $sort: { activeComplaintCount: 1, rating: -1 } },
  ]);

  return sendSuccess(res, { data: availableWorkers });
});
