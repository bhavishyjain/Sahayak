const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

function issueToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  // Only store the minimum non-sensitive identifiers — no PII
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" },
  );
}

// ── Refresh token helpers ────────────────────────────────────────────────────

function generateRefreshToken() {
  return crypto.randomBytes(40).toString("base64url");
}

async function storeRefreshToken(userId, plainToken) {
  const tokenHash = crypto
    .createHash("sha256")
    .update(plainToken)
    .digest("hex");
  const days = parseInt(process.env.REFRESH_TOKEN_DAYS || "30", 10);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const now = new Date();

  // Atomically: drop expired tokens, append new one, keep last 10 devices
  await User.updateOne({ _id: userId }, [
    {
      $set: {
        refreshTokens: {
          $slice: [
            {
              $concatArrays: [
                {
                  $filter: {
                    input: { $ifNull: ["$refreshTokens", []] },
                    as: "t",
                    cond: { $gt: ["$$t.expiresAt", now] },
                  },
                },
                [{ tokenHash, expiresAt }],
              ],
            },
            -10,
          ],
        },
      },
    },
  ]);

  return expiresAt;
}

async function revokeRefreshToken(userId, plainToken) {
  const tokenHash = crypto
    .createHash("sha256")
    .update(plainToken)
    .digest("hex");
  await User.updateOne(
    { _id: userId },
    { $pull: { refreshTokens: { tokenHash } } },
  );
}

function setRefreshCookie(res, plainToken) {
  const days = parseInt(process.env.REFRESH_TOKEN_DAYS || "30", 10);
  res.cookie("refreshToken", plainToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: days * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
}

// Generate a cryptographically secure random token (hex string)
function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

// One-way hash a token for DB storage
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildUserPayload(user) {
  const payload = {
    id: user._id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    department: user.department,
    preferredLanguage: user.preferredLanguage || "en",
    isActive: user.isActive !== false,
  };

  if (user.role === "worker") {
    payload.rating = Number.isFinite(user.rating) ? user.rating : null;
    payload.performanceMetrics = user.performanceMetrics || {
      totalCompleted: 0,
      averageCompletionTime: 0,
      currentWeekCompleted: 0,
      customerRating: null,
    };
  }

  return payload;
}

module.exports = {
  issueToken,
  buildUserPayload,
  generateRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  setRefreshCookie,
  generateSecureToken,
  hashToken,
};
