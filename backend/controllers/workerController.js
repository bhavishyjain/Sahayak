const bcrypt = require("bcryptjs");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const { buildComplaintView } = require("../utils/complaintView");
const {
  calculateCompletionHours,
  updateWorkerCompletionStats,
} = require("../utils/workerPerformance");
const { getRequestUserId, getWorkerOrThrow, getComplaintOrThrow } = require("../services/accessService");
const { uploadFilesToCloudinary } = require("../services/mediaUploadService");

function atStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function atStartOfWeek() {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}

function requireRole(req, allowedRoles, message = "Forbidden") {
  if (!allowedRoles.includes(req.user?.role)) {
    throw new AppError(message, 403);
  }
}

async function computeWorkerMetrics(workerId) {
  const todayStart = atStartOfToday();
  const weekStart = atStartOfWeek();
  const [activeComplaints, completedCount, completedToday, completedThisWeek] =
    await Promise.all([
      Complaint.countDocuments({
        assignedTo: workerId,
        status: { $in: ["assigned", "in-progress", "needs-rework"] },
      }),
      Complaint.countDocuments({
        assignedTo: workerId,
        status: "resolved",
      }),
      Complaint.countDocuments({
        assignedTo: workerId,
        status: "resolved",
        updatedAt: { $gte: todayStart },
      }),
      Complaint.countDocuments({
        assignedTo: workerId,
        status: "resolved",
        updatedAt: { $gte: weekStart },
      }),
    ]);

  return {
    activeComplaints,
    completedCount,
    completedToday,
    completedThisWeek,
  };
}

exports.createWorker = asyncHandler(async (req, res) => {
  requireRole(req, ["admin"], "Only admins can create workers");

  const { username, password, fullName, email, phone, department, specializations } = req.body;
  if (!username || !password || !department) {
    throw new AppError("Username, password, and department are required", 400);
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    throw new AppError("Username already exists", 400);
  }

  const worker = await User.create({
    username,
    password: await bcrypt.hash(password, 10),
    fullName,
    email,
    phone,
    department,
    role: "worker",
    specializations: specializations || [],
  });

  const workerResponse = worker.toObject();
  delete workerResponse.password;
  delete workerResponse.workStatus;

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
  delete workerResponse.workStatus;

  return sendSuccess(res, { data: workerResponse }, "Worker updated successfully");
});

exports.getAllWorkers = asyncHandler(async (req, res) => {
  const { department } = req.query;
  const filter = { role: "worker" };
  if (department && department !== "all") filter.department = department;

  const workers = await User.find(filter)
    .select("-password")
    .populate("assignedComplaints", "ticketId status priority createdAt")
    .populate("completedComplaints", "ticketId status completedAt");

  const workersWithMetrics = await Promise.all(
    workers.map(async (worker) => {
      const metrics = await computeWorkerMetrics(worker._id);
      const workerData = worker.toObject();
      delete workerData.workStatus;
      return {
        ...workerData,
        metrics,
      };
    }),
  );

  return sendSuccess(res, { data: workersWithMetrics });
});

exports.getAvailableWorkers = asyncHandler(async (req, res) => {
  const { department } = req.params;
  const availableWorkers = await User.aggregate([
    {
      $match: {
        role: "worker",
        department,
        isActive: true,
      },
    },
    {
      $lookup: {
        from: "complaints",
        localField: "_id",
        foreignField: "assignedTo",
        as: "activeComplaints",
        pipeline: [{ $match: { status: { $in: ["assigned", "in-progress", "needs-rework"] } } }],
      },
    },
    { $addFields: { activeComplaintCount: { $size: "$activeComplaints" } } },
    { $project: { password: 0, activeComplaints: 0 } },
    { $sort: { activeComplaintCount: 1, rating: -1 } },
  ]);

  return sendSuccess(res, { data: availableWorkers });
});

exports.assignComplaint = asyncHandler(async (req, res) => {
  requireRole(req, ["admin", "head"], "Only admins and department heads can assign complaints");
  const { complaintId, workerId, estimatedTime } = req.body;
  const complaint = await getComplaintOrThrow(complaintId);
  const worker = await getWorkerOrThrow(workerId);

  if (worker.department !== complaint.department) {
    throw new AppError("Worker department does not match complaint department", 400);
  }

  const requesterId = getRequestUserId(req);
  complaint.assignedTo = workerId;
  complaint.status = "assigned";
  complaint.assignedAt = new Date();
  complaint.assignedBy = requesterId;
  complaint.estimatedCompletionTime = estimatedTime;
  complaint.history.push({
    status: "assigned",
    updatedBy: requesterId,
    timestamp: new Date(),
    note: `Assigned to ${worker.username} with estimated completion time of ${estimatedTime} hours`,
  });
  await complaint.save();

  await User.findByIdAndUpdate(workerId, { $push: { assignedComplaints: complaintId } });
  await complaint.populate("assignedTo", "username fullName department");
  await complaint.populate("assignedBy", "username");

  return sendSuccess(res, { data: complaint }, "Complaint assigned successfully");
});

exports.updateWorkerStatus = asyncHandler(async (req, res) => {
  const { workerId } = req.params;
  const { workLocation } = req.body;
  const requesterId = String(getRequestUserId(req));

  if (req.user.role !== "admin" && requesterId !== String(workerId)) {
    throw new AppError("You can only update your own status", 403);
  }

  const updateData = { lastActive: new Date() };
  if (workLocation) updateData.workLocation = workLocation;

  const worker = await User.findByIdAndUpdate(workerId, updateData, {
    new: true,
  }).select("-password");

  if (!worker) throw new AppError("Worker not found", 404);
  const workerData = worker.toObject();
  delete workerData.workStatus;
  return sendSuccess(res, { data: workerData }, "Worker status updated successfully");
});

exports.getWorkerDashboard = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const assignedComplaints = await Complaint.find({
    assignedTo: workerId,
    status: { $in: ["assigned", "in-progress", "needs-rework", "pending-approval"] },
  })
    .populate({
      path: "userId",
      select: "fullName email phone username",
      model: "User",
    })
    .sort({ priority: -1, createdAt: -1 });

  const todayStart = atStartOfToday();
  const weekStart = atStartOfWeek();

  const [completedToday, totalCompleted, totalAssigned, weekCompleted, pendingApproval] =
    await Promise.all([
      Complaint.find({
        assignedTo: workerId,
        status: "resolved",
        updatedAt: { $gte: todayStart },
      }),
      Complaint.countDocuments({ assignedTo: workerId, status: "resolved" }),
      Complaint.countDocuments({ assignedTo: workerId }),
      Complaint.countDocuments({
        assignedTo: workerId,
        status: "resolved",
        updatedAt: { $gte: weekStart },
      }),
      Complaint.countDocuments({ assignedTo: workerId, status: "pending-approval" }),
    ]);

  return sendSuccess(res, {
    data: {
      assignedComplaints,
      completedToday,
      statistics: {
        totalCompleted,
        totalAssigned,
        completedToday: completedToday.length,
        weekCompleted,
        activeComplaints: assignedComplaints.length,
        pendingApproval,
      },
    },
  });
});

exports.updateComplaintStatus = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { status, workerNotes } = req.body;
  const workerId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId);

  if (String(complaint.assignedTo) !== String(workerId)) {
    throw new AppError("You are not assigned to this complaint", 403);
  }

  const completionPhotos = await uploadFilesToCloudinary(
    req.files || [],
    "completion_photos",
  );

  const oldStatus = complaint.status;
  complaint.status = status;
  if (workerNotes) complaint.workerNotes = workerNotes;

  if (completionPhotos.length > 0) {
    complaint.completionPhotos = [
      ...(complaint.completionPhotos || []),
      ...completionPhotos.map((photo) => photo.url),
    ];
  }

  if (status === "pending-approval") {
    if (!complaint.completionPhotos || complaint.completionPhotos.length === 0) {
      throw new AppError(
        "Completion photos are required when submitting for approval",
        400,
      );
    }
  }

  if (status === "resolved" && oldStatus !== "resolved") {
    const completionTime = calculateCompletionHours(complaint);
    complaint.actualCompletionTime = completionTime;
    await updateWorkerCompletionStats(workerId, complaintId, completionTime);
  }

  complaint.history.push({
    status,
    updatedBy: workerId,
    timestamp: new Date(),
    note: workerNotes || `Status updated to ${status}`,
  });

  await complaint.save();
  return sendSuccess(res, { data: complaint }, "Complaint status updated successfully");
});

exports.getAssignedComplaints = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const complaints = await Complaint.find({
    assignedTo: workerId,
    status: { $in: ["assigned", "in-progress", "needs-rework"] },
  })
    .populate("userId", "fullName email phone")
    .sort({ assignedAt: -1 });

  return sendSuccess(res, { complaints: complaints.map(buildComplaintView) });
});

exports.getCompletedComplaints = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const complaints = await Complaint.find({
    assignedTo: workerId,
    status: "resolved",
  })
    .populate("userId", "fullName email phone")
    .sort({ updatedAt: -1 })
    .limit(50);

  return sendSuccess(res, { complaints: complaints.map(buildComplaintView) });
});

exports.getLeaderboard = asyncHandler(async (req, res) => {
  const currentWorkerId = getRequestUserId(req);
  const { period = "monthly", department } = req.query;

  const startDate = new Date();
  if (period === "weekly") startDate.setDate(startDate.getDate() - 7);
  else if (period === "monthly") startDate.setMonth(startDate.getMonth() - 1);
  else if (period === "yearly") startDate.setFullYear(startDate.getFullYear() - 1);

  const query = { role: "worker" };
  if (department) query.department = department;
  const workers = await User.find(query).select(
    "fullName username department performanceMetrics rating",
  );

  const leaderboardData = await Promise.all(
    workers.map(async (worker) => {
      const periodCompleted = await Complaint.countDocuments({
        assignedTo: worker._id,
        status: "resolved",
        updatedAt: { $gte: startDate },
      });

      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      const recentCompletions = await Complaint.find({
        assignedTo: worker._id,
        status: "resolved",
        updatedAt: { $gte: last30Days },
      })
        .select("updatedAt")
        .sort({ updatedAt: -1 });

      let currentStreak = 0;
      if (recentCompletions.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let checkDate = new Date(today);
        const completionDates = new Set(
          recentCompletions.map((c) => {
            const d = new Date(c.updatedAt);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          }),
        );

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (completionDates.has(today.getTime()) || completionDates.has(yesterday.getTime())) {
          if (!completionDates.has(today.getTime())) {
            checkDate = yesterday;
          }
          while (completionDates.has(checkDate.getTime())) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          }
        }
      }

      const metrics = worker.performanceMetrics || {};
      const totalCompleted = metrics.totalCompleted || 0;
      const avgTime = metrics.averageCompletionTime || 0;
      const rating = worker.rating || 0;
      const badges = [];

      if (totalCompleted >= 10 && avgTime > 0 && avgTime <= 24) {
        badges.push({
          id: "speed-demon",
          name: "Speed Demon",
          description: "Completes tasks in under 24 hours on average",
          icon: "⚡",
          color: "#F59E0B",
        });
      }
      if (totalCompleted >= 10 && rating >= 4.5) {
        badges.push({
          id: "quality-master",
          name: "Quality Master",
          description: "Maintains 4.5+ star rating",
          icon: "⭐",
          color: "#EAB308",
        });
      }
      if (totalCompleted >= 50) {
        badges.push({
          id: "community-hero",
          name: "Community Hero",
          description: "Resolved 50+ complaints",
          icon: "🏆",
          color: "#10B981",
        });
      }
      if (totalCompleted >= 100) {
        badges.push({
          id: "century-club",
          name: "Century Club",
          description: "Resolved 100+ complaints",
          icon: "💯",
          color: "#8B5CF6",
        });
      }
      if (currentStreak >= 7) {
        badges.push({
          id: "consistent-performer",
          name: "Consistent Performer",
          description: "7+ day streak",
          icon: "🔥",
          color: "#EF4444",
        });
      }
      if (periodCompleted >= 20 && period === "monthly") {
        badges.push({
          id: "rising-star",
          name: "Rising Star",
          description: "20+ completions this month",
          icon: "🌟",
          color: "#06B6D4",
        });
      }

      return {
        id: worker._id,
        fullName: worker.fullName,
        username: worker.username,
        department: worker.department,
        totalCompleted,
        periodCompleted,
        averageCompletionTime: avgTime,
        rating,
        currentStreak,
        badges,
        isCurrentUser: String(worker._id) === String(currentWorkerId),
      };
    }),
  );

  leaderboardData.sort((a, b) => {
    if (b.periodCompleted !== a.periodCompleted) {
      return b.periodCompleted - a.periodCompleted;
    }
    return b.rating - a.rating;
  });

  leaderboardData.forEach((worker, index) => {
    worker.rank = index + 1;
  });

  return sendSuccess(res, {
    data: {
      leaderboard: leaderboardData,
      currentUser: leaderboardData.find((w) => w.isCurrentUser),
      period,
      totalWorkers: leaderboardData.length,
    },
  });
});
