const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Register User
exports.registerUser = async (req, res) => {
  try {
    const { username, password, role, fullName, email, phone } = req.body;

    // Validation
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Please provide username and password" });
    }

    if (!fullName) {
      return res.status(400).json({ message: "Please provide your full name" });
    }

    if (!email) {
      return res
        .status(400)
        .json({ message: "Please provide your email address" });
    }

    if (!phone) {
      return res
        .status(400)
        .json({ message: "Please provide your phone number" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Check if phone already exists
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      password: hashedPassword,
      role: role || "user",
      fullName,
      email,
      phone,
    });

    res
      .status(201)
      .json({ message: "User registered successfully", userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// Login User
exports.loginUser = async (req, res) => {
  try {
    const { emailOrPhone, password, username } = req.body;

    // Support both old username field and new emailOrPhone field for backward compatibility
    const loginIdentifier = emailOrPhone || username;

    // Validation
    if (!loginIdentifier || !password) {
      return res
        .status(400)
        .json({ message: "Please provide email/phone and password" });
    }

    // Find user by email or phone number
    const user = await User.findOne({
      $or: [
        { email: loginIdentifier },
        { phone: loginIdentifier },
        { username: loginIdentifier }, // Keep username for backward compatibility
      ],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create session
    req.session.user = {
      id: user._id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      department: user.department,
    };

    res.status(200).json({
      message: "Login successful",
      user: req.session.user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// Logout
exports.logoutUser = (req, res) => {
  const sessionId = req.sessionID;

  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy error:", err);
      return res.status(500).json({ message: "Failed to logout" });
    }

    // Clear the session cookie
    res.clearCookie("connect.sid", {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    console.log(`User logged out, session ${sessionId} destroyed`);
    res.status(200).json({ message: "Logout successful" });
  });
};

// Check authentication status
exports.getMe = (req, res) => {
  console.log("Auth check - Session exists:", !!req.session);
  console.log("Auth check - Session user:", req.session?.user);
  console.log("Auth check - Session ID:", req.sessionID);

  if (req.session && req.session.user) {
    res.status(200).json({ user: req.session.user });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
};
