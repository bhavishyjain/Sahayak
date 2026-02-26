const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function issueToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      preferredLanguage: user.preferredLanguage || "en",
    },
    process.env.JWT_SECRET || "api_dev_secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

function userPayload(user) {
  const payload = {
    id: user._id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    department: user.department,
    preferredLanguage: user.preferredLanguage || "en",
  };

  // Include rating and performance metrics for workers
  if (user.role === "worker") {
    payload.rating = user.rating || 4.5;
    payload.performanceMetrics = user.performanceMetrics || {
      totalCompleted: 0,
      averageCompletionTime: 0,
      currentWeekCompleted: 0,
      customerRating: 4.5,
    };
  }

  return payload;
}

exports.register = async (req, res) => {
  try {
    const { username, password, fullName, email, phone, role } = req.body;

    if (!username || !password || !fullName || !email || !phone) {
      return res.status(400).json({
        message: "username, password, fullName, email and phone are required",
      });
    }

    const existing = await User.findOne({
      $or: [{ username }, { email }, { phone }],
    });

    if (existing) {
      return res
        .status(409)
        .json({ message: "User already exists with provided details" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      fullName,
      email,
      phone,
      role: role || "user",
    });

    const token = issueToken(user);

    return res.status(201).json({
      message: "Account created",
      token,
      user: userPayload(user),
    });
  } catch (error) {
    console.error("register error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res
        .status(400)
        .json({ message: "loginId and password are required" });
    }

    const user = await User.findOne({
      $or: [{ username: loginId }, { email: loginId }, { phone: loginId }],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = issueToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: userPayload(user),
    });
  } catch (error) {
    console.error("login error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: userPayload(user) });
  } catch (error) {
    console.error("me error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullName, email, phone, password, preferredLanguage } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          email_phone_already_used: true,
          message: "Email is already in use",
        });
      }
      user.email = email;
    }

    if (phone && phone !== user.phone) {
      const existingPhone = await User.findOne({ phone, _id: { $ne: userId } });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          email_phone_already_used: true,
          message: "Phone is already in use",
        });
      }
      user.phone = phone;
    }

    if (typeof fullName === "string" && fullName.trim()) {
      user.fullName = fullName.trim();
    }

    if (preferredLanguage) {
      user.preferredLanguage = preferredLanguage;
    }

    // Update password if provided
    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      user.password = hashedPassword;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      user: userPayload(user),
    });
  } catch (error) {
    console.error("update me error", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
