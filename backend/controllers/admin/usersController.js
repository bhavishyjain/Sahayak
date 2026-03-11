const User = require("../../models/User");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { createUserAccount } = require("../../services/userProvisionService");
const {
  getWorkerMetrics,
  calculateWorkerPerformanceScore,
} = require("../../services/workerMetricsService");

// admin cannot escalate anyone to admin via this endpoint
const ASSIGNABLE_ROLES = ["user", "worker", "head"];

exports.listUsers = asyncHandler(async (req, res) => {
  const { role, department, includeStats = "false" } = req.query;
  const filter = {};
  if (role && role !== "all") filter.role = role;
  if (department && department !== "all") filter.department = department;

  const users = await User.find(filter).select("-password");
  if (includeStats !== "true") {
    return sendSuccess(res, { data: users, total: users.length });
  }

  const usersWithStats = await Promise.all(
    users.map(async (user) => {
      if (user.role !== "worker") return user.toObject();
      const metrics = await getWorkerMetrics(user._id);

      return {
        ...user.toObject(),
        name: user.fullName || user.username,
        activeCases: metrics.activeComplaints,
        completedCases: metrics.completedCount,
        completedToday: metrics.completedToday,
        rating: user.rating || 4.5,
        status: user.isActive ? "active" : "offline",
        performanceScore: calculateWorkerPerformanceScore(metrics),
      };
    }),
  );

  return sendSuccess(res, {
    data: usersWithStats,
    total: usersWithStats.length,
  });
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) throw new AppError("User not found", 404);
  return sendSuccess(res, { data: user });
});

exports.createUser = asyncHandler(async (req, res) => {
  const {
    username,
    password,
    fullName,
    email,
    phone,
    role = "worker",
    department,
  } = req.body;
  if (!username || !password || !fullName || !email || !phone) {
    throw new AppError(
      "username, password, fullName, email and phone are required",
      400,
    );
  }
  const newUser = await createUserAccount({
    username,
    password,
    fullName,
    email,
    phone,
    role,
    department,
  });

  const userResponse = newUser.toObject();
  delete userResponse.password;

  return sendSuccess(res, { data: userResponse }, "User created successfully", 201);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const { username, role, department } = req.body;

  if (role !== undefined && !ASSIGNABLE_ROLES.includes(role)) {
    throw new AppError(
      "Invalid role. Allowed values: " + ASSIGNABLE_ROLES.join(", "),
      400,
    );
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { username, role, department },
    { new: true, runValidators: true },
  ).select("-password");

  if (!user) throw new AppError("User not found", 404);
  return sendSuccess(res, { data: user }, "User updated successfully");
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError("User not found", 404);
  return sendSuccess(res, {}, "User deleted successfully");
});
