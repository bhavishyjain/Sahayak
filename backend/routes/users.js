const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Complaint = require("../models/Complaint");
const { isAuthenticated } = require("../middlewares/authMiddleware");

// Get all users/workers with detailed stats
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const { role, department, includeStats = false } = req.query;
    let filter = {};

    if (role && role !== "all") {
      filter.role = role;
    }

    if (department && department !== "all") {
      filter.department = department;
    }

    const users = await User.find(filter).select("-password");

    // If includeStats is true and role is worker, add complaint statistics
    if (
      includeStats === "true" &&
      (!role || role === "worker" || role === "all")
    ) {
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          if (user.role === "worker") {
            // Get complaint statistics for this worker
            const activeCases = await Complaint.countDocuments({
              assignedTo: user._id,
              status: { $in: ["assigned", "in-progress"] },
            });

            const completedCases = await Complaint.countDocuments({
              assignedTo: user._id,
              status: "resolved",
            });

            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const completedToday = await Complaint.countDocuments({
              assignedTo: user._id,
              status: "resolved",
              updatedAt: { $gte: todayStart },
            });

            // Calculate performance score based on completion rate
            const totalAssigned = await Complaint.countDocuments({
              assignedTo: user._id,
            });

            const performanceScore =
              totalAssigned > 0
                ? Math.min(
                    Math.round((completedCases / totalAssigned) * 100),
                    100
                  )
                : 85; // Default score for new workers

            return {
              ...user.toObject(),
              name: user.fullName || user.username, // Provide consistent name field
              activeCases,
              completedCases,
              completedToday,
              rating: 4.0 + Math.random() * 1.0, // Mock rating (4.0-5.0)
              status: user.isActive ? "active" : "offline",
              performanceScore,
              experience: calculateExperience(user.createdAt),
              specializations: getSpecializationsByDepartment(user.department),
            };
          }
          return user.toObject();
        })
      );

      return res.json({
        success: true,
        data: usersWithStats,
        total: usersWithStats.length,
      });
    }

    res.json({
      success: true,
      data: users,
      total: users.length,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users",
    });
  }
});

// Helper function to calculate experience
function calculateExperience(joinDate) {
  const now = new Date();
  const joined = new Date(joinDate);
  const diffTime = Math.abs(now - joined);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);

  if (years > 0) {
    return `${years} year${years > 1 ? "s" : ""}`;
  } else if (months > 0) {
    return `${months} month${months > 1 ? "s" : ""}`;
  } else {
    return "New";
  }
}

// Helper function to get specializations by department
function getSpecializationsByDepartment(department) {
  const specializations = {
    road: ["Pothole Repair", "Road Maintenance", "Traffic Management"],
    water: ["Pipe Repair", "Water Quality Testing", "Leak Detection"],
    electricity: [
      "Street Lighting",
      "Power Grid Maintenance",
      "Electrical Repairs",
    ],
    waste: ["Waste Collection", "Recycling Management", "Disposal Operations"],
    drainage: ["Drain Cleaning", "Sewerage Maintenance", "Flood Prevention"],
    other: ["General Maintenance", "Public Works"],
  };

  return specializations[department] || specializations.other;
}

// Get user by ID
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user",
    });
  }
});

// Create new user/worker
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const { username, password, role, department } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const newUser = new User({
      username,
      password, // In production, this should be hashed
      role: role || "worker",
      department,
    });

    await newUser.save();

    // Return user without password
    const userResponse = { ...newUser.toObject() };
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userResponse,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating user",
    });
  }
});

// Update user
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const { username, role, department } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username, role, department },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating user",
    });
  }
});

// Delete user
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting user",
    });
  }
});

module.exports = router;
