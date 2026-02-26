const Complaint = require("../models/Complaint");
const User = require("../models/User");

// Get HOD dashboard with department-specific data (for mobile app)
exports.getHodDashboard = async (req, res) => {
  try {
    const hodId = req.currentUser.id || req.currentUser._id;
    const hod = await User.findById(hodId);

    if (!hod || hod.role !== "head") {
      return res.status(403).json({ message: "Access denied. HOD only." });
    }

    const department = hod.department;

    // Get complaints in this department
    const complaints = await Complaint.find({ department })
      .populate("userId", "fullName email phone")
      .populate("assignedTo", "fullName username")
      .sort({ createdAt: -1 })
      .limit(50);

    // Format complaints for mobile
    const complaintsList = complaints.map((c) => ({
      id: c._id,
      ticketId: c.ticketId,
      title: c.rawText?.split(":")[0] || "Complaint",
      description: c.refinedText || c.rawText,
      department: c.department,
      priority: c.priority,
      status: c.status,
      locationName: c.locationName,
      coordinates: c.coordinates,
      assignedTo: c.assignedTo?._id,
      assignedWorkerName: c.assignedTo?.fullName,
      upvoteCount: c.upvoteCount || 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    // Get statistics
    const total = await Complaint.countDocuments({ department });
    const pending = await Complaint.countDocuments({
      department,
      status: "pending",
    });
    const assigned = await Complaint.countDocuments({
      department,
      status: "assigned",
    });
    const inProgress = await Complaint.countDocuments({
      department,
      status: "in-progress",
    });
    const resolved = await Complaint.countDocuments({
      department,
      status: "resolved",
    });
    const closed = await Complaint.countDocuments({
      department,
      status: "closed",
    });

    // Priority statistics
    const highPriority = await Complaint.countDocuments({
      department,
      priority: "High",
    });
    const mediumPriority = await Complaint.countDocuments({
      department,
      priority: "Medium",
    });
    const lowPriority = await Complaint.countDocuments({
      department,
      priority: "Low",
    });

    // Worker statistics
    const totalWorkers = await User.countDocuments({
      role: "worker",
      department: department,
    });
    const activeWorkers = await User.countDocuments({
      role: "worker",
      department: department,
      workStatus: "available",
    });

    // Upvote statistics
    const complaintsWithUpvotes = await Complaint.find({ department }).select(
      "upvoteCount",
    );
    const totalUpvotes = complaintsWithUpvotes.reduce(
      (sum, c) => sum + (c.upvoteCount || 0),
      0,
    );

    // Response time calculation (average time from creation to assignment)
    const assignedComplaints = await Complaint.find({
      department,
      assignedAt: { $exists: true },
      createdAt: { $exists: true },
    }).select("createdAt assignedAt");

    let avgResponseTime = null;
    if (assignedComplaints.length > 0) {
      const totalResponseTime = assignedComplaints.reduce((sum, c) => {
        const responseTime =
          (new Date(c.assignedAt) - new Date(c.createdAt)) / (1000 * 60 * 60); // hours
        return sum + responseTime;
      }, 0);
      avgResponseTime = Math.round(
        totalResponseTime / assignedComplaints.length,
      );
    }

    // Performance score calculation
    const completionRate =
      total > 0 ? Math.round(((resolved + closed) / total) * 100) : 0;
    const responseScore = avgResponseTime
      ? Math.max(0, 100 - avgResponseTime * 2)
      : 50; // penalize slower response
    const pendingPenalty = total > 0 ? (pending / total) * 30 : 0;
    const performanceScore = Math.round(
      completionRate * 0.5 + responseScore * 0.3 + (100 - pendingPenalty) * 0.2,
    );

    const stats = {
      department: department,
      total: total,
      pending: pending,
      assigned: assigned,
      inProgress: inProgress,
      resolved: resolved,
      closed: closed,
      highPriority: highPriority,
      mediumPriority: mediumPriority,
      lowPriority: lowPriority,
      totalWorkers: totalWorkers,
      activeWorkers: activeWorkers,
      totalUpvotes: totalUpvotes,
      avgResponseTime: avgResponseTime,
      performanceScore: performanceScore,
    };

    return res.status(200).json({
      complaints: complaintsList,
      stats: stats,
    });
  } catch (error) {
    console.error("Get HOD dashboard error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get workers in HOD's department (for mobile app)
exports.getHodWorkers = async (req, res) => {
  try {
    const hodId = req.currentUser.id || req.currentUser._id;
    const hod = await User.findById(hodId);

    if (!hod || hod.role !== "head") {
      return res.status(403).json({ message: "Access denied. HOD only." });
    }

    const department = hod.department;

    // Get all workers in this department
    const workers = await User.find({
      role: "worker",
      department: department,
    }).select("-password");

    // Get metrics for each worker
    const workersWithMetrics = await Promise.all(
      workers.map(async (worker) => {
        const activeComplaints = await Complaint.countDocuments({
          assignedTo: worker._id,
          status: { $in: ["assigned", "in-progress"] },
        });

        const completedCount = await Complaint.countDocuments({
          assignedTo: worker._id,
          status: { $in: ["resolved", "closed"] },
        });

        return {
          id: worker._id,
          username: worker.username,
          fullName: worker.fullName,
          email: worker.email,
          phone: worker.phone,
          department: worker.department,
          workStatus: worker.workStatus,
          rating: worker.rating,
          activeComplaints: activeComplaints,
          completedCount: completedCount,
        };
      }),
    );

    return res.status(200).json({ workers: workersWithMetrics });
  } catch (error) {
    console.error("Get HOD workers error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Assign complaint to worker (for mobile app)
exports.assignComplaintToWorker = async (req, res) => {
  try {
    const { complaintId, workerId } = req.body;
    const hodId = req.currentUser.id || req.currentUser._id;
    const hod = await User.findById(hodId);

    if (!hod || hod.role !== "head") {
      return res.status(403).json({ message: "Access denied. HOD only." });
    }

    if (!complaintId || !workerId) {
      return res
        .status(400)
        .json({ message: "Complaint ID and Worker ID are required" });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Check if complaint is in HOD's department
    if (complaint.department !== hod.department) {
      return res
        .status(403)
        .json({ message: "This complaint is not in your department" });
    }

    const worker = await User.findById(workerId);
    if (!worker || worker.role !== "worker") {
      return res.status(404).json({ message: "Worker not found" });
    }

    // Check if worker is in the same department
    if (worker.department !== hod.department) {
      return res
        .status(400)
        .json({ message: "Worker is not in your department" });
    }

    // Assign the complaint
    complaint.assignedTo = workerId;
    complaint.assignedBy = hodId;
    complaint.assignedAt = new Date();
    complaint.status = "assigned";

    // Add history entry
    complaint.history.push({
      status: "assigned",
      timestamp: new Date(),
      note: `Assigned to ${worker.fullName || worker.username} by HOD`,
    });

    await complaint.save();

    return res.status(200).json({
      message: "Complaint assigned successfully",
      complaint: {
        id: complaint._id,
        assignedTo: workerId,
        status: complaint.status,
      },
    });
  } catch (error) {
    console.error("Assign complaint error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
