const bcrypt = require("bcryptjs");
const User = require("../models/User");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const { issueToken, buildUserPayload } = require("../services/authService");
const {
  validateRegisterBody,
  validateLoginBody,
} = require("../validators/authValidators");

exports.register = asyncHandler(async (req, res) => {
  validateRegisterBody(req.body);

  const { username, password, fullName, email, phone, role } = req.body;

  const existing = await User.findOne({
    $or: [{ username }, { email }, { phone }],
  });

  if (existing) {
    throw new AppError("User already exists with provided details", 409);
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

  return sendSuccess(
    res,
    { token: issueToken(user), user: buildUserPayload(user) },
    "Account created",
    201,
  );
});

exports.login = asyncHandler(async (req, res) => {
  validateLoginBody(req.body);

  const { loginId, password } = req.body;
  const user = await User.findOne({
    $or: [{ username: loginId }, { email: loginId }, { phone: loginId }],
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", 401);
  }

  return sendSuccess(
    res,
    { token: issueToken(user), user: buildUserPayload(user) },
    "Login successful",
  );
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return sendSuccess(res, { user: buildUserPayload(user) });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { fullName, email, phone, password, preferredLanguage } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (email && email !== user.email) {
    const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
    if (existingEmail) {
      throw new AppError("Email is already in use", 400, {
        email_phone_already_used: true,
      });
    }
    user.email = email;
  }

  if (phone && phone !== user.phone) {
    const existingPhone = await User.findOne({ phone, _id: { $ne: userId } });
    if (existingPhone) {
      throw new AppError("Phone is already in use", 400, {
        email_phone_already_used: true,
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

  if (password && password.trim()) {
    user.password = await bcrypt.hash(password.trim(), 10);
  }

  await user.save();

  return sendSuccess(
    res,
    {
      user: buildUserPayload(user),
      email_phone_already_used: false,
    },
    "Profile updated",
  );
});
