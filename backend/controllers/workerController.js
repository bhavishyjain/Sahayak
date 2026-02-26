const User = require("../models/User");
const Complaint = require("../models/Complaint");
const bcrypt = require("bcryptjs");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// Create a new worker (Admin only)
exports.createWorker = async (req, res) => {
  try {
    const {
      username,
      password,
      fullName,
      email,
      phone,
      department,
      specializations,
    } = req.body;

    // Check if user is admin
    if (!req.currentUser || req.currentUser.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can create workers",
      });
    }

    // Validation
    if (!username || !password || !department) {
      return res.status(400).json({
        success: false,
        message: "Username, password, and department are required",
      });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create worker
    const worker = await User.create({
      username,
      password: hashedPassword,
      fullName,
      email,
      phone,
      department,
      role: "worker",
      specializations: specializations || [],
      workStatus: "available",
    });

    // Remove password from response
    const workerResponse = worker.toObject();
    delete workerResponse.password;

    res.status(201).json({
      success: true,
      message: "Worker created successfully",
      data: workerResponse,
    });
  } catch (error) {
    console.error("Error creating worker:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Server error while creating worker",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update worker information (Admin only)
exports.updateWorker = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { fullName, email, phone, department, specializations } = req.body;

    // Check if user is admin
    if (!req.currentUser || req.currentUser.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update workers",
      });
    }

    // Find the worker
    const worker = await User.findById(workerId);
    if (!worker || worker.role !== "worker") {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    // Update fields
    if (fullName) worker.fullName = fullName;
    if (email) worker.email = email;
    if (phone) worker.phone = phone;
    if (department) worker.department = department;
    if (specializations) worker.specializations = specializations;

    await worker.save();

    // Remove password from response
    const workerResponse = worker.toObject();
    delete workerResponse.password;

    res.json({
      success: true,
      message: "Worker updated successfully",
      data: workerResponse,
    });
  } catch (error) {
    console.error("Error updating worker:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating worker",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all workers with their current workload
exports.getAllWorkers = async (req, res) => {
  try {
    const { department, status, available } = req.query;

    // Build filter
    let filter = { role: "worker" };
    if (department && department !== "all") {
      filter.department = department;
    }
    if (status && status !== "all") {
      filter.workStatus = status;
    }
    if (available === "true") {
      filter.workStatus = "available";
    }

    // Get workers with their complaint data
    const workers = await User.find(filter)
      .select("-password")
      .populate("assignedComplaints", "ticketId status priority createdAt")
      .populate("completedComplaints", "ticketId status completedAt");

    // Calculate additional metrics for each worker
    const workersWithMetrics = await Promise.all(
      workers.map(async (worker) => {
        const workerObj = worker.toObject();

        // Get current active complaints count
        const activeComplaints = await Complaint.countDocuments({
          assignedTo: worker._id,
          status: { $in: ["assigned", "in-progress"] },
        });

        // Get completed complaints count
        const completedCount = await Complaint.countDocuments({
          assignedTo: worker._id,
          status: "resolved",
        });

        // Get today's completed count
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const completedToday = await Complaint.countDocuments({
          assignedTo: worker._id,
          status: "resolved",
          updatedAt: { $gte: todayStart },
        });

        // Get this week's completed count
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const completedThisWeek = await Complaint.countDocuments({
          assignedTo: worker._id,
          status: "resolved",
          updatedAt: { $gte: weekStart },
        });

        return {
          ...workerObj,
          metrics: {
            activeComplaints,
            completedCount,
            completedToday,
            completedThisWeek,
            isAvailable:
              activeComplaints < 5 && worker.workStatus === "available", // Max 5 active complaints
          },
        };
      }),
    );

    res.json({
      success: true,
      data: workersWithMetrics,
    });
  } catch (error) {
    console.error("Error fetching workers:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching workers",
    });
  }
};

// Get available workers for a specific department
exports.getAvailableWorkers = async (req, res) => {
  try {
    const { department } = req.params;

    // Find workers who are available and have less than 5 active complaints
    const availableWorkers = await User.aggregate([
      {
        $match: {
          role: "worker",
          department: department,
          workStatus: "available",
          isActive: true,
        },
      },
      {
        $lookup: {
          from: "complaints",
          localField: "_id",
          foreignField: "assignedTo",
          as: "activeComplaints",
          pipeline: [
            {
              $match: {
                status: { $in: ["assigned", "in-progress"] },
              },
            },
          ],
        },
      },
      {
        $addFields: {
          activeComplaintCount: { $size: "$activeComplaints" },
        },
      },
      {
        $match: {
          activeComplaintCount: { $lt: 5 }, // Workers with less than 5 active complaints
        },
      },
      {
        $project: {
          password: 0,
          activeComplaints: 0,
        },
      },
      {
        $sort: {
          activeComplaintCount: 1, // Sort by least busy first
          rating: -1, // Then by highest rating
        },
      },
    ]);

    res.json({
      success: true,
      data: availableWorkers,
    });
  } catch (error) {
    console.error("Error fetching available workers:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching available workers",
    });
  }
};

// Assign complaint to worker
exports.assignComplaint = async (req, res) => {
  try {
    const { complaintId, workerId, estimatedTime } = req.body;

    // Check if user is admin or head
    if (!req.currentUser || !["admin", "head"].includes(req.currentUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Only admins and department heads can assign complaints",
      });
    }

    // Find complaint and worker
    const complaint = await Complaint.findById(complaintId);
    const worker = await User.findById(workerId);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    if (!worker || worker.role !== "worker") {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    if (worker.workStatus !== "available") {
      return res.status(400).json({
        success: false,
        message: "Worker is not available",
      });
    }

    if (worker.department !== complaint.department) {
      return res.status(400).json({
        success: false,
        message: "Worker department does not match complaint department",
      });
    }

    // Check worker's current workload
    const activeComplaints = await Complaint.countDocuments({
      assignedTo: workerId,
      status: { $in: ["assigned", "in-progress"] },
    });

    if (activeComplaints >= 5) {
      return res.status(400).json({
        success: false,
        message: "Worker already has maximum number of active complaints",
      });
    }

    // Assign complaint
    complaint.assignedTo = workerId;
    complaint.status = "assigned";
    complaint.assignedAt = new Date();
    complaint.assignedBy = req.currentUser.id || req.currentUser._id;
    complaint.estimatedCompletionTime = estimatedTime;

    // Add to complaint history
    complaint.history.push({
      status: "assigned",
      updatedBy: req.currentUser.id || req.currentUser._id,
      timestamp: new Date(),
      note: `Assigned to ${worker.username} with estimated completion time of ${estimatedTime} hours`,
    });

    await complaint.save();

    // Update worker's assigned complaints
    await User.findByIdAndUpdate(workerId, {
      $push: { assignedComplaints: complaintId },
    });

    // Populate the assigned complaint for response
    await complaint.populate("assignedTo", "username fullName department");
    await complaint.populate("assignedBy", "username");
    res.json({
      success: true,
      message: "Complaint assigned successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Error assigning complaint:", error);
    res.status(500).json({
      success: false,
      message: "Server error while assigning complaint",
    });
  }
};

// Update worker status
exports.updateWorkerStatus = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { workStatus, workLocation } = req.body;

    // Workers can update their own status, admins can update any worker's status
    if (
      req.currentUser.role !== "admin" &&
      (req.currentUser.id || req.currentUser._id).toString() !== workerId
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own status",
      });
    }

    const updateData = {};
    if (workStatus) updateData.workStatus = workStatus;
    if (workLocation) updateData.workLocation = workLocation;
    updateData.lastActive = new Date();

    const worker = await User.findByIdAndUpdate(workerId, updateData, {
      new: true,
    }).select("-password");

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    res.json({
      success: true,
      message: "Worker status updated successfully",
      data: worker,
    });
  } catch (error) {
    console.error("Error updating worker status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating worker status",
    });
  }
};

// Get worker dashboard data
exports.getWorkerDashboard = async (req, res) => {
  try {
    const workerId = req.currentUser.id || req.currentUser._id;

    // Get worker's assigned complaints with user details populated
    const assignedComplaints = await Complaint.find({
      assignedTo: workerId,
      status: { $in: ["assigned", "in-progress"] },
    })
      .populate({
        path: "userId",
        select: "fullName email phone username",
        model: "User",
      })
      .sort({ priority: -1, createdAt: -1 });

    // Get worker's completed complaints for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const completedToday = await Complaint.find({
      assignedTo: workerId,
      status: "resolved",
      updatedAt: { $gte: todayStart },
    });

    // Get worker's statistics
    const totalCompleted = await Complaint.countDocuments({
      assignedTo: workerId,
      status: "resolved",
    });

    const totalAssigned = await Complaint.countDocuments({
      assignedTo: workerId,
    });

    // Get this week's statistics
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekCompleted = await Complaint.countDocuments({
      assignedTo: workerId,
      status: "resolved",
      updatedAt: { $gte: weekStart },
    });

    res.json({
      success: true,
      data: {
        assignedComplaints,
        completedToday,
        statistics: {
          totalCompleted,
          totalAssigned,
          completedToday: completedToday.length,
          weekCompleted,
          activeComplaints: assignedComplaints.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching worker dashboard:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching worker dashboard",
    });
  }
};

// Update complaint status by worker

exports.updateComplaintStatus = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { status, workerNotes } = req.body;
    const workerId = req.currentUser.id || req.currentUser._id;

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    // Ensure worker is assigned
    if (complaint.assignedTo.toString() !== workerId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this complaint",
      });
    }

    // Upload images to Cloudinary
    let completionPhotos = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: "completion_photos" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              },
            );
            streamifier.createReadStream(file.buffer).pipe(uploadStream);
          });

          completionPhotos.push({
            url: result.secure_url,
            publicId: result.public_id,
          });
        } catch (uploadError) {
          console.error("Error uploading to Cloudinary:", uploadError.message);
        }
      }
    }

    // Update complaint
    const oldStatus = complaint.status;
    complaint.status = status;
    if (workerNotes) complaint.workerNotes = workerNotes;

    if (completionPhotos.length > 0) {
      const photoUrls = completionPhotos.map((photo) => photo.url);
      complaint.completionPhotos = [
        ...(complaint.completionPhotos || []),
        ...photoUrls,
      ];
    }

    // If resolved, update worker metrics
    if (status === "resolved" && oldStatus !== "resolved") {
      let completionTime = 0;

      // Calculate completion time safely
      if (complaint.assignedAt) {
        completionTime =
          (new Date() - new Date(complaint.assignedAt)) / (1000 * 60 * 60); // hours
      } else {
        // Fallback to using createdAt if assignedAt is not available
        completionTime =
          (new Date() - new Date(complaint.createdAt)) / (1000 * 60 * 60); // hours
      }

      // Ensure completion time is reasonable (positive and not too large)
      if (
        isNaN(completionTime) ||
        completionTime < 0 ||
        completionTime > 8760
      ) {
        // max 1 year
        completionTime = 1; // Default to 1 hour if calculation fails
      }

      complaint.actualCompletionTime = completionTime;

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

      // Calculate new average completion time safely
      let newAvg;
      if (totalCompleted <= 1) {
        // First completion
        newAvg = completionTime;
      } else {
        // Calculate average for multiple completions
        newAvg =
          (currentAvg * (totalCompleted - 1) + completionTime) / totalCompleted;
      }

      // Ensure newAvg is a valid number
      if (isNaN(newAvg) || !isFinite(newAvg)) {
        newAvg = completionTime; // Fallback to current completion time
      }

      await User.findByIdAndUpdate(workerId, {
        "performanceMetrics.averageCompletionTime": newAvg,
      });
    }

    // Add history log
    complaint.history.push({
      status,
      updatedBy: workerId,
      timestamp: new Date(),
      note: workerNotes || `Status updated to ${status}`,
    });

    await complaint.save();

    res.json({
      success: true,
      message: "Complaint status updated successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Error updating complaint status:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating complaint status",
    });
  }
};

// Get assigned complaints for logged-in worker (for mobile app)
exports.getAssignedComplaints = async (req, res) => {
  try {
    const workerId = req.currentUser.id || req.currentUser._id;

    const complaints = await Complaint.find({
      assignedTo: workerId,
      status: { $in: ["assigned", "in-progress"] },
    })
      .populate("userId", "fullName email phone")
      .sort({ assignedAt: -1 });

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
      assignedAt: c.assignedAt,
      createdAt: c.createdAt,
    }));

    return res.status(200).json({ complaints: complaintsList });
  } catch (error) {
    console.error("Get assigned complaints error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get completed complaints for logged-in worker (for mobile app)
exports.getCompletedComplaints = async (req, res) => {
  try {
    const workerId = req.currentUser.id || req.currentUser._id;

    const complaints = await Complaint.find({
      assignedTo: workerId,
      status: { $in: ["resolved", "closed"] },
    })
      .populate("userId", "fullName email phone")
      .sort({ updatedAt: -1 })
      .limit(50);

    const complaintsList = complaints.map((c) => ({
      id: c._id,
      ticketId: c.ticketId,
      title: c.rawText?.split(":")[0] || "Complaint",
      description: c.refinedText || c.rawText,
      department: c.department,
      status: c.status,
      locationName: c.locationName,
      coordinates: c.coordinates,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      feedback: c.feedback,
    }));

    return res.status(200).json({ complaints: complaintsList });
  } catch (error) {
    console.error("Get completed complaints error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
