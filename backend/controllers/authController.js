const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const WorkerInvitation = require("../models/WorkerInvitation");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const { issueToken, buildUserPayload } = require("../services/authService");
const { createUserAccount } = require("../services/userProvisionService");
const {
  validateRegisterBody,
  validateLoginBody,
} = require("../validators/authValidators");

exports.register = asyncHandler(async (req, res) => {
  validateRegisterBody(req.body);

  const { username, password, fullName, email, phone, inviteToken } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  let invitation = null;

  if (inviteToken) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(String(inviteToken))
      .digest("hex");
    invitation = await WorkerInvitation.findOne({
      tokenHash,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      throw new AppError("Invalid or expired invitation token", 400);
    }
    if (invitation.email !== normalizedEmail) {
      throw new AppError("Invitation token does not match this email", 400);
    }
  }

  const role = invitation ? "worker" : "user";
  const department = invitation ? invitation.department : "Other";
  const user = await createUserAccount({
    username,
    password,
    fullName,
    email: normalizedEmail,
    phone,
    role,
    department,
  });

  if (invitation) {
    invitation.acceptedAt = new Date();
    invitation.acceptedBy = user._id;
    await invitation.save();
  }

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
  const normalizedLoginId = String(loginId || "").trim();
  const lowerLoginId = normalizedLoginId.toLowerCase();
  const user = await User.findOne({
    $or: [
      { username: lowerLoginId },
      { email: lowerLoginId },
      { phone: normalizedLoginId },
    ],
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

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = String(phone || "").trim();

  if (normalizedEmail && normalizedEmail !== user.email) {
    const existingEmail = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: userId },
    });
    if (existingEmail) {
      throw new AppError("Email is already in use", 400, {
        email_phone_already_used: true,
      });
    }
    user.email = normalizedEmail;
  }

  if (normalizedPhone && normalizedPhone !== user.phone) {
    const existingPhone = await User.findOne({
      phone: normalizedPhone,
      _id: { $ne: userId },
    });
    if (existingPhone) {
      throw new AppError("Phone is already in use", 400, {
        email_phone_already_used: true,
      });
    }
    user.phone = normalizedPhone;
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
