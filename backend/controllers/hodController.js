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
    const pendingApproval = await Complaint.countDocuments({
      department,
      status: "pending-approval",
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
      pendingApproval: pendingApproval,
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

    // Calculate ETA based on historical data
    const eta = await calculateETA(complaint, worker);
    complaint.estimatedCompletionTime = eta;

    // Add history entry
    complaint.history.push({
      status: "assigned",
      timestamp: new Date(),
      note: `Assigned to ${worker.fullName || worker.username} by HOD. ETA: ${eta} hours`,
    });

    await complaint.save();

    return res.status(200).json({
      message: "Complaint assigned successfully",
      complaint: {
        id: complaint._id,
        assignedTo: workerId,
        status: complaint.status,
        estimatedCompletionTime: eta,
      },
    });
  } catch (error) {
    console.error("Assign complaint error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
// Approve complaint completion (HOD reviews worker's completion)
exports.approveCompletion = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { hodNotes } = req.body;
    const hodId = req.currentUser.id || req.currentUser._id;

    const hod = await User.findById(hodId);
    if (!hod || hod.role !== "head") {
      return res.status(403).json({
        success: false,
        message: "Access denied. HOD only.",
      });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Check department match
    if (complaint.department !== hod.department) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not in your department",
      });
    }

    // Verify status
    if (complaint.status !== "pending-approval") {
      return res.status(400).json({
        success: false,
        message: "Complaint is not pending approval",
      });
    }

    // Update to resolved
    complaint.status = "resolved";

    // Calculate completion time and update worker metrics
    const workerId = complaint.assignedTo;
    if (workerId && complaint.assignedAt) {
      let completionTime =
        (new Date() - new Date(complaint.assignedAt)) / (1000 * 60 * 60); // hours

      if (
        isNaN(completionTime) ||
        completionTime < 0 ||
        completionTime > 8760
      ) {
        completionTime =
          (new Date() - new Date(complaint.createdAt)) / (1000 * 60 * 60);
      }

      if (isNaN(completionTime) || completionTime < 0) {
        completionTime = 1;
      }

      complaint.actualCompletionTime = completionTime;

      // Update worker metrics
      await User.findByIdAndUpdate(workerId, {
        $pull: { assignedComplaints: complaintId },
        $push: { completedComplaints: complaintId },
        $inc: {
          "performanceMetrics.totalCompleted": 1,
          "performanceMetrics.currentWeekCompleted": 1,
        },
      });

      const worker = await User.findById(workerId);
      const totalCompleted = worker.performanceMetrics.totalCompleted;
      const currentAvg = worker.performanceMetrics.averageCompletionTime || 0;

      let newAvg;
      if (totalCompleted <= 1) {
        newAvg = completionTime;
      } else {
        newAvg =
          (currentAvg * (totalCompleted - 1) + completionTime) / totalCompleted;
      }

      if (isNaN(newAvg) || !isFinite(newAvg)) {
        newAvg = completionTime;
      }

      await User.findByIdAndUpdate(workerId, {
        "performanceMetrics.averageCompletionTime": newAvg,
      });
    }

    // Add history entry
    complaint.history.push({
      status: "resolved",
      updatedBy: hodId,
      timestamp: new Date(),
      note: hodNotes || "Approved by HOD",
    });

    await complaint.save();

    return res.status(200).json({
      success: true,
      message: "Complaint approved and marked as resolved",
      data: complaint,
    });
  } catch (error) {
    console.error("Approve completion error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Reject complaint completion (HOD sends back for rework)
exports.rejectCompletion = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { rejectionReason } = req.body;
    const hodId = req.currentUser.id || req.currentUser._id;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const hod = await User.findById(hodId);
    if (!hod || hod.role !== "head") {
      return res.status(403).json({
        success: false,
        message: "Access denied. HOD only.",
      });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    // Check department match
    if (complaint.department !== hod.department) {
      return res.status(403).json({
        success: false,
        message: "This complaint is not in your department",
      });
    }

    // Verify status
    if (complaint.status !== "pending-approval") {
      return res.status(400).json({
        success: false,
        message: "Complaint is not pending approval",
      });
    }

    // Send back to in-progress
    complaint.status = "in-progress";

    // Add history entry
    complaint.history.push({
      status: "in-progress",
      updatedBy: hodId,
      timestamp: new Date(),
      note: `Rejected by HOD: ${rejectionReason}`,
    });

    await complaint.save();

    return res.status(200).json({
      success: true,
      message: "Complaint sent back for rework",
      data: complaint,
    });
  } catch (error) {
    console.error("Reject completion error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Bulk assign complaints to worker
exports.bulkAssignComplaints = async (req, res) => {
  try {
    const { complaintIds, workerId } = req.body;
    const hodId = req.currentUser.id || req.currentUser._id;

    if (
      !complaintIds ||
      !Array.isArray(complaintIds) ||
      complaintIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Complaint IDs array is required",
      });
    }

    if (!workerId) {
      return res.status(400).json({
        success: false,
        message: "Worker ID is required",
      });
    }

    const hod = await User.findById(hodId);
    if (!hod || hod.role !== "head") {
      return res.status(403).json({
        success: false,
        message: "Access denied. HOD only.",
      });
    }

    // Verify worker
    const worker = await User.findById(workerId);
    if (!worker || worker.role !== "worker") {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    if (worker.department !== hod.department) {
      return res.status(400).json({
        success: false,
        message: "Worker is not in your department",
      });
    }

    const results = {
      successful: [],
      failed: [],
    };

    // Process each complaint
    for (const complaintId of complaintIds) {
      try {
        const complaint = await Complaint.findById(complaintId);

        if (!complaint) {
          results.failed.push({
            complaintId,
            reason: "Complaint not found",
          });
          continue;
        }

        if (complaint.department !== hod.department) {
          results.failed.push({
            complaintId,
            reason: "Not in your department",
          });
          continue;
        }

        // Assign the complaint
        complaint.assignedTo = workerId;
        complaint.assignedBy = hodId;
        complaint.assignedAt = new Date();
        complaint.status = "assigned";

        // Calculate ETA based on historical data
        const eta = await calculateETA(complaint, worker);
        complaint.estimatedCompletionTime = eta;

        complaint.history.push({
          status: "assigned",
          updatedBy: hodId,
          timestamp: new Date(),
          note: `Bulk assigned to ${worker.fullName || worker.username} by HOD`,
        });

        await complaint.save();

        results.successful.push({
          complaintId,
          ticketId: complaint.ticketId,
        });
      } catch (error) {
        results.failed.push({
          complaintId,
          reason: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Assigned ${results.successful.length} out of ${complaintIds.length} complaints`,
      data: results,
    });
  } catch (error) {
    console.error("Bulk assign error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Calculate predicted ETA for complaint completion
async function calculateETA(complaint, worker) {
  try {
    // Base hours by priority
    const baseHours = {
      High: 24,
      Medium: 72,
      Low: 168,
    };

    let estimatedHours = baseHours[complaint.priority] || 72;

    // Factor 1: Worker's average completion time for this department
    if (
      worker.performanceMetrics &&
      worker.performanceMetrics.averageCompletionTime
    ) {
      const workerAvg = worker.performanceMetrics.averageCompletionTime;
      estimatedHours = (estimatedHours + workerAvg) / 2; // Weighted average
    }

    // Factor 2: Historical data for similar complaints
    const similarComplaints = await Complaint.find({
      department: complaint.department,
      priority: complaint.priority,
      status: "resolved",
      actualCompletionTime: { $exists: true, $gt: 0 },
    })
      .sort({ updatedAt: -1 })
      .limit(10);

    if (similarComplaints.length > 0) {
      const avgSimilar =
        similarComplaints.reduce((sum, c) => sum + c.actualCompletionTime, 0) /
        similarComplaints.length;

      estimatedHours = (estimatedHours + avgSimilar) / 2; // Further weighted average
    }

    // Factor 3: Current workload adjustment
    const activeWorkload = await Complaint.countDocuments({
      assignedTo: worker._id,
      status: { $in: ["assigned", "in-progress"] },
    });

    // Add 20% delay for each active complaint the worker has
    estimatedHours = estimatedHours * (1 + activeWorkload * 0.2);

    // Round to nearest hour, minimum 1 hour
    return Math.max(1, Math.round(estimatedHours));
  } catch (error) {
    console.error("ETA calculation error:", error);
    // Return default based on priority
    const defaults = { High: 24, Medium: 72, Low: 168 };
    return defaults[complaint.priority] || 72;
  }
}

// Get complaints for a specific worker (for mobile app)
exports.getWorkerComplaints = async (req, res) => {
  try {
    const hodId = req.currentUser.id || req.currentUser._id;
    const hod = await User.findById(hodId);

    if (!hod || hod.role !== "head") {
      return res.status(403).json({ message: "Access denied. HOD only." });
    }

    const { workerId } = req.params;
    const { status } = req.query; // optional: 'active', 'completed', or all if not specified

    // Verify worker is in HOD's department
    const worker = await User.findById(workerId);
    if (!worker || worker.department !== hod.department) {
      return res
        .status(404)
        .json({ message: "Worker not found in your department" });
    }

    // Build query
    let query = { assignedTo: workerId };
    if (status === "active") {
      query.status = { $in: ["assigned", "in-progress"] };
    } else if (status === "completed") {
      query.status = { $in: ["resolved", "closed"] };
    }

    // Get complaints
    const complaints = await Complaint.find(query)
      .populate("userId", "fullName email phone")
      .sort({ updatedAt: -1 });

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
      upvoteCount: c.upvoteCount || 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      assignedAt: c.assignedAt,
    }));

    return res.status(200).json({
      complaints: complaintsList,
      total: complaintsList.length,
    });
  } catch (error) {
    console.error("Get worker complaints error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
