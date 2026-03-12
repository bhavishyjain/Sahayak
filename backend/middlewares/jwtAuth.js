const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../core/AppError");

function normalizeUser(userDoc) {
  return {
    _id: userDoc._id,
    id: userDoc._id,
    role: userDoc.role,
    username: userDoc.username,
    fullName: userDoc.fullName,
    email: userDoc.email,
    phone: userDoc.phone,
    department: userDoc.department,
    preferredLanguage: userDoc.preferredLanguage || "en",
  };
}

function resolveToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

async function attachAuth(req, res, next) {
  try {
    const token = resolveToken(req);
    if (!token) return next();

    if (!process.env.JWT_SECRET) {
      return next(new AppError("JWT_SECRET environment variable is not set", 500));
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // DB fetch on every request: validates the token against current user state
    // (handles account deletion, deactivation, and forced token revocation)
    const user = await User.findById(payload.userId).select("-password");
    if (!user || !user.isActive) {
      return next(new AppError("Invalid or expired token", 401));
    }

    // Reject tokens issued before tokenValidFrom (password reset, forced logout, etc.)
    // Compare at second granularity because JWT iat is in whole seconds while
    // tokenValidFrom has millisecond precision — tokens issued in the same second
    // as tokenValidFrom must still be accepted.
    if (user.tokenValidFrom && Math.floor(user.tokenValidFrom.getTime() / 1000) > payload.iat) {
      return next(new AppError("Token has been revoked", 401));
    }

    req.user = normalizeUser(user);
    req.currentUser = req.user;
    return next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return next(new AppError("Invalid or expired token", 401));
    }
    return next(err);
  }
}

function requireAuth(req, res, next) {
  if (!req.user?._id) {
    return next(new AppError("Authentication required", 401));
  }
  return next();
}

module.exports = {
  attachAuth,
  requireAuth,
};
