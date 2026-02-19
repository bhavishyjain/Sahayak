const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

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
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function userPayload(user) {
  return {
    id: user._id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    department: user.department,
    preferredLanguage: user.preferredLanguage || "en",
  };
}

exports.register = async (req, res) => {
  try {
    const { username, password, fullName, email, phone, role } = req.body;

    if (!username || !password || !fullName || !email || !phone) {
      return res.status(400).json({
        message:
          "username, password, fullName, email and phone are required",
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
