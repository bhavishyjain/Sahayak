const User = require("../../models/User");
const Complaint = require("../../models/Complaint");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { createUserAccount } = require("../../services/userProvisionService");
const { assertDepartmentExists } = require("../../services/departmentService");
const {
  getWorkerMetrics,
  calculateWorkerPerformanceScore,
} = require("../../services/workerMetricsService");
const {
  buildNotificationPayload,
  persistNotification,
} = require("../../services/notificationDomainService");
const {
  ACTIVE_COMPLAINT_STATUSES,
  NOTIFICATION_TYPES,
  ROLES,
} = require("../../domain/constants");
const {
  emitComplaintUpdated,
  emitRealtimeEvent,
} = require("../../services/realtimeService");

// admin cannot escalate anyone to admin via this endpoint
const ASSIGNABLE_ROLES = ["user", "worker", "head"];

async function notifyDepartmentHeadsAboutMemberStatusChange(user, isActive) {
  if (!user?.department || !["worker", "head"].includes(user.role)) {
    return;
  }

  const recipients = await User.find({
    role: "head",
    department: user.department,
    isActive: true,
    _id: { $ne: user._id },
  }).select("_id");

  if (!recipients.length) {
    return;
  }

  const displayName = user.fullName || user.username || "A team member";
  const statusLabel = isActive ? "reactivated" : "deactivated";
  const payload = buildNotificationPayload({
    title: `${displayName} ${statusLabel}`,
    body: `${displayName} has been ${statusLabel} by admin in ${user.department} Department.`,
    data: {
      type: NOTIFICATION_TYPES.SYSTEM,
    },
  });

  await Promise.all(
    recipients.map((recipient) => persistNotification(recipient._id, payload)),
  );
}

async function emitAdminUserStatusEvent(user, isActive) {
  const admins = await User.find({
    role: ROLES.ADMIN,
    isActive: true,
    _id: { $ne: user._id },
  }).select("_id");

  emitRealtimeEvent(
    "admin-updated",
    {
      event: isActive ? "user-reactivated" : "user-deactivated",
      userId: String(user._id),
      role: user.role,
      department: user.department,
      updatedAt: new Date().toISOString(),
    },
    { userIds: admins.map((admin) => admin._id) },
  );
}

async function releaseWorkerComplaintsForReassignment(worker, actorId) {
  if (!worker?._id || worker.role !== "worker") {
    return 0;
  }

  const activeComplaints = await Complaint.find({
    "assignedWorkers.workerId": worker._id,
    status: { $in: ACTIVE_COMPLAINT_STATUSES },
  }).select(
    "_id ticketId status assignedWorkers department updatedAt history assignedAt assignedBy estimatedCompletionTime resolvedAt",
  );

  if (activeComplaints.length === 0) {
    return 0;
  }

  const now = new Date();
  const workerName = worker.fullName || worker.username || "Worker";

  await Promise.all(
    activeComplaints.map(async (complaint) => {
      complaint.assignedWorkers = [];
      complaint.status = "pending";
      complaint.assignedAt = null;
      complaint.assignedBy = null;
      complaint.estimatedCompletionTime = undefined;
      complaint.resolvedAt = null;
      complaint.history.push({
        status: "pending",
        updatedBy: actorId,
        timestamp: now,
        note: `${workerName} was deactivated by admin. Complaint moved back to pending for reassignment.`,
      });
      await complaint.save();
      await emitComplaintUpdated({
        complaint,
        actorId,
        event: "worker-deactivated-reassignment",
        extra: {
          reason: "worker-deactivated",
          requiresReassignment: true,
        },
      });
    }),
  );

  return activeComplaints.length;
}

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
        rating: Number.isFinite(user.rating) ? user.rating : null,
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
  const { username, role, department, fullName, email, phone, isActive } = req.body;

  if (role !== undefined && !ASSIGNABLE_ROLES.includes(role)) {
    throw new AppError(
      "Invalid role. Allowed values: " + ASSIGNABLE_ROLES.join(", "),
      400,
    );
  }

  const update = {};
  if (username !== undefined) update.username = username;
  if (role !== undefined) update.role = role;
  if (fullName !== undefined) update.fullName = fullName;
  if (email !== undefined) update.email = email;
  if (phone !== undefined) update.phone = phone;
  if (typeof isActive === "boolean") update.isActive = isActive;

  const existingUser = await User.findById(req.params.id).select(
    "role department isActive fullName username",
  );
  if (!existingUser) throw new AppError("User not found", 404);

  const nextRole = role !== undefined ? role : existingUser.role;
  const nextDepartment =
    department !== undefined ? department : existingUser.department;

  if (["worker", "head"].includes(nextRole)) {
    await assertDepartmentExists(nextDepartment);
  }

  if (department !== undefined) update.department = department;

  const user = await User.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (
    typeof isActive === "boolean" &&
    existingUser.isActive !== isActive
  ) {
    if (existingUser.role === "worker" && isActive === false) {
      await releaseWorkerComplaintsForReassignment(
        existingUser,
        req.user?._id || req.user?.userId || null,
      );
    }
    await notifyDepartmentHeadsAboutMemberStatusChange(user, isActive);
    await emitAdminUserStatusEvent(user, isActive);
  }

  return sendSuccess(res, { data: user }, "User updated successfully");
});

exports.deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new AppError("User not found", 404);
  return sendSuccess(res, {}, "User deleted successfully");
});
