const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const WorkerInvitation = require("../models/WorkerInvitation");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const {
  issueToken,
  buildUserPayload,
  generateRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  setRefreshCookie,
  generateSecureToken,
  hashToken,
} = require("../services/authService");
const { createUserAccount } = require("../services/userProvisionService");
const {
  validateRegisterBody,
  validateLoginBody,
} = require("../validators/authValidators");
const {
  sendEmailVerification,
  sendPasswordResetEmail,
} = require("../services/emailService");

exports.register = asyncHandler(async (req, res) => {
  validateRegisterBody(req.body);

  const { username, password, fullName, email, phone, inviteToken } = req.body;
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
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

  // Workers are invited by email — trusted; citizens must verify
  if (role === "user") {
    const plainToken = generateSecureToken();
    await User.updateOne({ _id: user._id }, {
      emailVerificationTokenHash: hashToken(plainToken),
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    sendEmailVerification(normalizedEmail, fullName, plainToken).catch((err) =>
      console.error("register: verification email error", err),
    );
  } else {
    // Workers' email is confirmed by HOD invitation
    await User.updateOne({ _id: user._id }, { emailVerified: true });
  }

  const plainRefreshToken = generateRefreshToken();
  await storeRefreshToken(user._id, plainRefreshToken);
  setRefreshCookie(res, plainRefreshToken);

  return sendSuccess(
    res,
    {
      token: issueToken(user),
      refreshToken: plainRefreshToken,
      user: buildUserPayload(user),
    },
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

  // Citizens must verify their email before logging in
  if (user.role === "user" && !user.emailVerified) {
    throw new AppError(
      "Please verify your email address before logging in. Check your inbox for a verification link.",
      403,
      { emailUnverified: true },
    );
  }

  const plainRefreshToken = generateRefreshToken();
  await storeRefreshToken(user._id, plainRefreshToken);
  setRefreshCookie(res, plainRefreshToken);

  return sendSuccess(
    res,
    {
      token: issueToken(user),
      refreshToken: plainRefreshToken,
      user: buildUserPayload(user),
    },
    "Login successful",
  );
});

exports.refresh = asyncHandler(async (req, res) => {
  const plainToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!plainToken) throw new AppError("Refresh token required", 401);

  const tokenHash = require("crypto")
    .createHash("sha256")
    .update(plainToken)
    .digest("hex");

  const user = await User.findOne({
    refreshTokens: {
      $elemMatch: { tokenHash, expiresAt: { $gt: new Date() } },
    },
    isActive: true,
  }).select("-password");

  if (!user) throw new AppError("Invalid or expired refresh token", 401);

  // Rotate: revoke old token and issue a new one
  await revokeRefreshToken(user._id, plainToken);
  const newPlainToken = generateRefreshToken();
  await storeRefreshToken(user._id, newPlainToken);
  setRefreshCookie(res, newPlainToken);

  return sendSuccess(
    res,
    {
      token: issueToken(user),
      refreshToken: newPlainToken,
      user: buildUserPayload(user),
    },
    "Token refreshed",
  );
});

exports.logout = asyncHandler(async (req, res) => {
  const plainToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (plainToken) {
    // Use authenticated userId if available, otherwise scan all users (slower but safe)
    const userId = req.user?._id;
    if (userId) {
      await revokeRefreshToken(userId, plainToken);
    } else {
      const tokenHash = require("crypto")
        .createHash("sha256")
        .update(plainToken)
        .digest("hex");
      await User.updateOne(
        { "refreshTokens.tokenHash": tokenHash },
        { $pull: { refreshTokens: { tokenHash } } },
      );
    }
  }

  res.clearCookie("refreshToken", { path: "/api/auth" });
  return sendSuccess(res, null, "Logged out successfully");
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  if (!user) {
    throw new AppError("User not found", 404);
  }

  return sendSuccess(res, { user: buildUserPayload(user) });
});

exports.deleteMe = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password)
    throw new AppError("Password is required to delete your account", 400);

  const user = await User.findById(req.user._id);
  if (!user) throw new AppError("User not found", 404);

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) throw new AppError("Incorrect password", 401);

  await User.findByIdAndDelete(req.user._id);

  return sendSuccess(res, null, "Account deleted");
});

exports.acceptInvite = asyncHandler(async (req, res) => {
  const { inviteToken } = req.body;
  if (!inviteToken) throw new AppError("inviteToken is required", 400);

  const tokenHash = crypto
    .createHash("sha256")
    .update(String(inviteToken))
    .digest("hex");

  const invitation = await WorkerInvitation.findOne({
    tokenHash,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!invitation) throw new AppError("Invalid or expired invitation", 400);
  if (invitation.email !== req.user.email) {
    throw new AppError(
      "This invitation was sent to a different email address",
      403,
    );
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { role: "worker", department: invitation.department },
    { new: true },
  );

  invitation.acceptedAt = new Date();
  invitation.acceptedBy = user._id;
  await invitation.save();

  const plainRefreshToken = generateRefreshToken();
  await storeRefreshToken(user._id, plainRefreshToken);
  setRefreshCookie(res, plainRefreshToken);

  return sendSuccess(
    res,
    {
      token: issueToken(user),
      refreshToken: plainRefreshToken,
      user: buildUserPayload(user),
    },
    "You have joined as a worker",
  );
});

exports.updateMe = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { fullName, email, phone, password, preferredLanguage } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
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

// ── Password reset ────────────────────────────────────────────────────────────

exports.forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  if (!email) throw new AppError("Email is required", 400);

  // Always respond with a generic message to prevent user enumeration
  const genericMsg =
    "If an account with that email exists, a reset link has been sent";

  const user = await User.findOne({ email });
  if (!user) return sendSuccess(res, null, genericMsg);

  const plainToken = generateSecureToken();
  user.passwordResetTokenHash = hashToken(plainToken);
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  sendPasswordResetEmail(user.email, user.fullName, plainToken).catch((err) =>
    console.error("forgotPassword: email error", err),
  );

  return sendSuccess(res, null, genericMsg);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!token) throw new AppError("Reset token is required", 400);
  if (!password || String(password).length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  const tokenHash = hashToken(String(token));
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) throw new AppError("Invalid or expired reset token", 400);

  user.password = await bcrypt.hash(String(password), 10);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  // Invalidate all existing sessions issued before now
  user.tokenValidFrom = new Date();
  user.refreshTokens = [];
  await user.save();

  res.clearCookie("refreshToken", { path: "/api/auth" });
  return sendSuccess(
    res,
    null,
    "Password reset successful. Please log in again.",
  );
});

// ── Email verification ────────────────────────────────────────────────────────

exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token) throw new AppError("Verification token is required", 400);

  const tokenHash = hashToken(String(token));
  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  });

  if (!user) throw new AppError("Invalid or expired verification link", 400);
  if (user.emailVerified)
    return sendSuccess(res, null, "Email already verified");

  user.emailVerified = true;
  user.emailVerificationTokenHash = null;
  user.emailVerificationExpires = null;
  await user.save();

  return sendSuccess(res, null, "Email verified successfully");
});

exports.resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError("User not found", 404);
  if (user.emailVerified) throw new AppError("Email is already verified", 409);

  // Rate-limit: don't re-send if a non-expired token already exists
  if (
    user.emailVerificationExpires &&
    user.emailVerificationExpires > new Date()
  ) {
    throw new AppError(
      "A verification email was sent recently. Please check your inbox.",
      429,
    );
  }

  const plainToken = generateSecureToken();
  user.emailVerificationTokenHash = hashToken(plainToken);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await user.save();

  sendEmailVerification(user.email, user.fullName, plainToken).catch((err) =>
    console.error("resendVerification: email error", err),
  );

  return sendSuccess(res, null, "Verification email sent");
});
