const bcrypt = require("bcryptjs");
const express = require("express");
const Complaint = require("../models/Complaint");
const User = require("../models/User");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(attachAuth, requireAuth, authorize("admin"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
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

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [activeCases, completedCases, completedToday, totalAssigned] =
          await Promise.all([
            Complaint.countDocuments({
              assignedTo: user._id,
              status: { $in: ["assigned", "in-progress"] },
            }),
            Complaint.countDocuments({
              assignedTo: user._id,
              status: "resolved",
            }),
            Complaint.countDocuments({
              assignedTo: user._id,
              status: "resolved",
              updatedAt: { $gte: todayStart },
            }),
            Complaint.countDocuments({ assignedTo: user._id }),
          ]);

        const performanceScore =
          totalAssigned > 0
            ? Math.min(Math.round((completedCases / totalAssigned) * 100), 100)
            : 0;

        return {
          ...user.toObject(),
          name: user.fullName || user.username,
          activeCases,
          completedCases,
          completedToday,
          rating: user.rating || 4.5,
          status: user.isActive ? "active" : "offline",
          performanceScore,
        };
      }),
    );

    return sendSuccess(res, {
      data: usersWithStats,
      total: usersWithStats.length,
    });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) throw new AppError("User not found", 404);
    return sendSuccess(res, { data: user });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { username, password, role = "worker", department } = req.body;
    if (!username || !password) {
      throw new AppError("username and password are required", 400);
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) throw new AppError("User already exists", 400);

    const newUser = await User.create({
      username,
      password: await bcrypt.hash(password, 10),
      role,
      department,
    });

    const userResponse = newUser.toObject();
    delete userResponse.password;

    return sendSuccess(
      res,
      { data: userResponse },
      "User created successfully",
      201,
    );
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const { username, role, department } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username, role, department },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) throw new AppError("User not found", 404);
    return sendSuccess(res, { data: user }, "User updated successfully");
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new AppError("User not found", 404);
    return sendSuccess(res, {}, "User deleted successfully");
  }),
);

module.exports = router;
