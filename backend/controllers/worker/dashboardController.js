const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { buildComplaintView } = require("../../utils/complaintView");
const { getRequestUserId, getHodOrThrow } = require("../../services/accessService");
const { atStartOfToday, atStartOfWeek } = require("./helpers");

exports.getWorkerDashboard = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const assignedComplaints = await Complaint.find({
    "assignedWorkers.workerId": workerId,
    status: {
      $in: ["assigned", "in-progress", "needs-rework", "pending-approval"],
    },
  })
    .populate({
      path: "userId",
      select: "fullName email phone username",
      model: "User",
    })
    .sort({ priority: -1, createdAt: -1 });

  const todayStart = atStartOfToday();
  const weekStart = atStartOfWeek();

  const [
    completedToday,
    totalCompleted,
    totalAssigned,
    weekCompleted,
    pendingApproval,
  ] = await Promise.all([
    Complaint.find({
      "assignedWorkers.workerId": workerId,
      status: "resolved",
      updatedAt: { $gte: todayStart },
    }),
    Complaint.countDocuments({
      "assignedWorkers.workerId": workerId,
      status: "resolved",
    }),
    Complaint.countDocuments({ "assignedWorkers.workerId": workerId }),
    Complaint.countDocuments({
      "assignedWorkers.workerId": workerId,
      status: "resolved",
      updatedAt: { $gte: weekStart },
    }),
    Complaint.countDocuments({
      "assignedWorkers.workerId": workerId,
      status: "pending-approval",
    }),
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

exports.getAssignedComplaints = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const complaints = await Complaint.find({
    "assignedWorkers.workerId": workerId,
    status: { $in: ["assigned", "in-progress", "needs-rework"] },
  })
    .populate("userId", "fullName email phone")
    .sort({ assignedAt: -1 });

  return sendSuccess(res, { complaints: complaints.map(buildComplaintView) });
});

exports.getCompletedComplaints = asyncHandler(async (req, res) => {
  const workerId = getRequestUserId(req);
  const complaints = await Complaint.find({
    "assignedWorkers.workerId": workerId,
    status: "resolved",
  })
    .populate("userId", "fullName email phone")
    .sort({ updatedAt: -1 })
    .limit(50);

  return sendSuccess(res, { complaints: complaints.map(buildComplaintView) });
});

exports.getLeaderboard = asyncHandler(async (req, res) => {
  const currentWorkerId = getRequestUserId(req);
  const { period = "monthly", department: requestedDepartment } = req.query;

  const startDate = new Date();
  if (period === "weekly") startDate.setDate(startDate.getDate() - 7);
  else if (period === "monthly") startDate.setMonth(startDate.getMonth() - 1);
  else if (period === "yearly")
    startDate.setFullYear(startDate.getFullYear() - 1);

  const query = { role: "worker" };
  if (req.user.role === "head") {
    const hod = await getHodOrThrow(req);
    if (
      requestedDepartment &&
      requestedDepartment !== "all" &&
      requestedDepartment !== hod.department
    ) {
      throw new AppError("You can only view workers from your department", 403);
    }
    query.department = hod.department;
  } else if (requestedDepartment && requestedDepartment !== "all") {
    query.department = requestedDepartment;
  }
  const workers = await User.find(query).select(
    "fullName username department performanceMetrics rating",
  );

  const leaderboardData = await Promise.all(
    workers.map(async (worker) => {
      const periodCompleted = await Complaint.countDocuments({
        "assignedWorkers.workerId": worker._id,
        status: "resolved",
        updatedAt: { $gte: startDate },
      });

      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      const recentCompletions = await Complaint.find({
        "assignedWorkers.workerId": worker._id,
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
        if (
          completionDates.has(today.getTime()) ||
          completionDates.has(yesterday.getTime())
        ) {
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
      currentUser: leaderboardData.find((item) => item.isCurrentUser),
      period,
      totalWorkers: leaderboardData.length,
    },
  });
});
