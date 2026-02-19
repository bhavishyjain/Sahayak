const Complaint = require("../models/Complaint");
const User = require("../models/User");

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const { timeframe = "30days", department = "all" } = req.query;

    // Build date filter based on timeframe
    let dateFilter = {};
    if (timeframe !== "all") {
      const now = new Date();
      let startDate;

      switch (timeframe) {
        case "7days":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "30days":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
          break;
        case "90days":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 90);
          break;
        case "6months":
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case "1year":
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        dateFilter.createdAt = { $gte: startDate };
      }
    }

    // Build department filter
    let filter = { ...dateFilter };
    if (department !== "all") {
      filter.department = department;
    }

    // Get complaint statistics
    const totalComplaints = await Complaint.countDocuments(filter);
    const pendingComplaints = await Complaint.countDocuments({
      ...filter,
      status: { $in: ["pending", "assigned"] },
    });
    const inProgressComplaints = await Complaint.countDocuments({
      ...filter,
      status: "in-progress",
    });
    const resolvedComplaints = await Complaint.countDocuments({
      ...filter,
      status: "resolved",
    });

    // Get complaints by status
    const statusStats = await Complaint.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Get complaints by department
    const departmentStats = await Complaint.aggregate([
      { $match: filter },
      { $group: { _id: "$department", count: { $sum: 1 } } },
    ]);

    // Get complaints by priority
    const priorityStats = await Complaint.aggregate([
      { $match: filter },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    // Get worker statistics
    const totalWorkers = await User.countDocuments({ role: "worker" });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Calculate active workers properly
    const activeWorkers = await User.countDocuments({
      role: "worker",
      $and: [
        { workStatus: { $ne: "offline" } },
        { isActive: true },
        {
          $or: [
            { lastActive: { $gte: sevenDaysAgo } },
            { lastActive: { $exists: false } }, // Include workers without lastActive date
          ],
        },
      ],
    });

    console.log("Dashboard stats worker calculation:", {
      totalWorkers,
      activeWorkers,
      sevenDaysAgo,
    });

    // Calculate average resolution time (mock calculation)
    const resolvedComplaintsWithTime = await Complaint.find({
      ...filter,
      status: "resolved",
    }).select("createdAt updatedAt");

    const avgResolutionTime =
      resolvedComplaintsWithTime.length > 0
        ? resolvedComplaintsWithTime.reduce((acc, complaint) => {
            const resolutionTime =
              new Date(complaint.updatedAt) - new Date(complaint.createdAt);
            return acc + resolutionTime;
          }, 0) / resolvedComplaintsWithTime.length
        : 0;

    // Calculate percentage changes compared to previous period
    const percentageChanges = await calculatePercentageChanges(
      filter,
      timeframe,
      department
    );

    // Format response
    const byStatus = {};
    statusStats.forEach((stat) => {
      byStatus[stat._id] = stat.count;
    });

    const byDepartment = {};
    departmentStats.forEach((stat) => {
      byDepartment[stat._id] = stat.count;
    });

    const byPriority = {};
    priorityStats.forEach((stat) => {
      byPriority[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        totalComplaints,
        pendingComplaints,
        inProgressComplaints,
        resolvedComplaints,
        totalWorkers,
        activeWorkers,
        avgResolutionTimeHours: Math.round(
          avgResolutionTime / (1000 * 60 * 60)
        ),
        byStatus,
        byDepartment,
        byPriority,
        percentageChanges,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard statistics",
    });
  }
};

// Get recent complaints for dashboard
exports.getRecentComplaints = async (req, res) => {
  try {
    const { limit = 5, department = "all" } = req.query;

    let filter = {};
    if (department !== "all") {
      filter.department = department;
    }

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("userId", "username")
      .populate("assignedTo", "username");

    const formattedComplaints = complaints.map((complaint) => ({
      id: complaint._id,
      ticketId: complaint.ticketId,
      title:
        complaint.locationName ||
        complaint.refinedText?.substring(0, 50) ||
        "Complaint",
      description: complaint.refinedText,
      category: complaint.department,
      priority: complaint.priority,
      status: complaint.status,
      assignedTo: complaint.assignedTo?.username || "Unassigned",
      submittedBy: complaint.userId?.username || "Unknown",
      submittedAt: complaint.createdAt,
      location: complaint.locationName || "Unknown location",
      coordinates: complaint.coordinates,
    }));

    res.json({
      success: true,
      data: formattedComplaints,
    });
  } catch (error) {
    console.error("Error fetching recent complaints:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching recent complaints",
    });
  }
};

// Get worker performance stats for dashboard
exports.getWorkerStats = async (req, res) => {
  try {
    const { department = "all", available = false } = req.query;

    // Build filter
    let filter = { role: "worker" };
    if (department !== "all") {
      filter.department = department;
    }

    const workers = await User.find(filter).select("-password");

    // Get complaint counts for each worker
    const workerStats = await Promise.all(
      workers.map(async (worker) => {
        const activeCases = await Complaint.countDocuments({
          assignedTo: worker._id,
          status: { $in: ["assigned", "in-progress"] },
        });

        const completedCases = await Complaint.countDocuments({
          assignedTo: worker._id,
          status: "resolved",
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const completedToday = await Complaint.countDocuments({
          assignedTo: worker._id,
          status: "resolved",
          updatedAt: { $gte: todayStart },
        });

        // Check if worker is available for assignment
        const isAvailable =
          activeCases < 5 && worker.workStatus === "available";

        const workerData = {
          id: worker._id,
          _id: worker._id,
          name: worker.fullName || worker.username,
          username: worker.username,
          department: worker.department || "General",
          activeCases,
          completedCases,
          completedToday,
          rating: worker.rating || 4.5,
          status: worker.workStatus || "active",
          performanceScore: Math.min(
            100,
            Math.max(60, 90 - activeCases * 5 + completedToday * 10)
          ),
          isAvailable,
          email: worker.email,
          phone: worker.phone,
          specializations: worker.specializations || [],
          lastActive: worker.lastActive,
          workLocation: worker.workLocation,
        };

        return workerData;
      })
    );

    // Filter available workers if requested
    const filteredWorkers = available
      ? workerStats.filter((worker) => worker.isAvailable)
      : workerStats;

    res.json({
      success: true,
      data: filteredWorkers,
    });
  } catch (error) {
    console.error("Error fetching worker stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching worker statistics",
    });
  }
};

// Helper function to calculate percentage changes
const calculatePercentageChanges = async (
  currentFilter,
  timeframe,
  department
) => {
  try {
    // Calculate previous period dates
    let previousStartDate, previousEndDate;
    const now = new Date();

    switch (timeframe) {
      case "7days":
        previousStartDate = new Date(now);
        previousStartDate.setDate(previousStartDate.getDate() - 14);
        previousEndDate = new Date(now);
        previousEndDate.setDate(previousEndDate.getDate() - 7);
        break;
      case "30days":
        previousStartDate = new Date(now);
        previousStartDate.setDate(previousStartDate.getDate() - 60);
        previousEndDate = new Date(now);
        previousEndDate.setDate(previousEndDate.getDate() - 30);
        break;
      case "90days":
        previousStartDate = new Date(now);
        previousStartDate.setDate(previousStartDate.getDate() - 180);
        previousEndDate = new Date(now);
        previousEndDate.setDate(previousEndDate.getDate() - 90);
        break;
      case "6months":
        previousStartDate = new Date(now);
        previousStartDate.setMonth(previousStartDate.getMonth() - 12);
        previousEndDate = new Date(now);
        previousEndDate.setMonth(previousEndDate.getMonth() - 6);
        break;
      case "1year":
        previousStartDate = new Date(now);
        previousStartDate.setFullYear(previousStartDate.getFullYear() - 2);
        previousEndDate = new Date(now);
        previousEndDate.setFullYear(previousEndDate.getFullYear() - 1);
        break;
      default:
        return {
          totalComplaints: 0,
          resolvedComplaints: 0,
          pendingComplaints: 0,
          activeWorkers: 0,
        };
    }

    // Build previous period filter
    let previousFilter = {
      createdAt: {
        $gte: previousStartDate,
        $lte: previousEndDate,
      },
    };

    if (department !== "all") {
      previousFilter.department = department;
    }

    // Get previous period statistics
    const previousTotalComplaints = await Complaint.countDocuments(
      previousFilter
    );
    const previousPendingComplaints = await Complaint.countDocuments({
      ...previousFilter,
      status: { $in: ["pending", "assigned"] },
    });
    const previousResolvedComplaints = await Complaint.countDocuments({
      ...previousFilter,
      status: "resolved",
    });

    // Get current period statistics (from currentFilter)
    const currentTotalComplaints = await Complaint.countDocuments(
      currentFilter
    );
    const currentPendingComplaints = await Complaint.countDocuments({
      ...currentFilter,
      status: { $in: ["pending", "assigned"] },
    });
    const currentResolvedComplaints = await Complaint.countDocuments({
      ...currentFilter,
      status: "resolved",
    });

    // Get worker statistics for percentage change calculation
    const currentTime = new Date();
    const sevenDaysAgo = new Date(
      currentTime.getTime() - 7 * 24 * 60 * 60 * 1000
    );

    // Current active workers (workers who are not inactive and have been active recently)
    const currentActiveWorkers = await User.countDocuments({
      role: "worker",
      $and: [
        { workStatus: { $ne: "offline" } },
        { isActive: true },
        {
          $or: [
            { lastActive: { $gte: sevenDaysAgo } },
            { lastActive: { $exists: false } }, // Include workers without lastActive date
          ],
        },
      ],
    });

    // Previous period active workers
    const previousActiveWorkers = await User.countDocuments({
      role: "worker",
      $and: [
        { workStatus: { $ne: "offline" } },
        { isActive: true },
        {
          $or: [
            { lastActive: { $gte: previousStartDate, $lte: previousEndDate } },
            { createdAt: { $gte: previousStartDate, $lte: previousEndDate } }, // Include newly created workers
          ],
        },
      ],
    });

    console.log("Worker percentage calculation:", {
      currentActiveWorkers,
      previousActiveWorkers,
      timeframe,
      currentPeriod: {
        start: new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: currentTime,
      },
      previousPeriod: { start: previousStartDate, end: previousEndDate },
    });

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      totalComplaints: calculateChange(
        currentTotalComplaints,
        previousTotalComplaints
      ),
      resolvedComplaints: calculateChange(
        currentResolvedComplaints,
        previousResolvedComplaints
      ),
      pendingComplaints: calculateChange(
        currentPendingComplaints,
        previousPendingComplaints
      ),
      activeWorkers: calculateChange(
        currentActiveWorkers,
        previousActiveWorkers
      ),
    };
  } catch (error) {
    console.error("Error calculating percentage changes:", error);
    return {
      totalComplaints: 0,
      resolvedComplaints: 0,
      pendingComplaints: 0,
      activeWorkers: 0,
    };
  }
};
