const jwt = require("jsonwebtoken");
const AppError = require("../core/AppError");

function normalizeUser(userObj) {
  return {
    _id: userObj.id || userObj._id,
    id: userObj.id || userObj._id,
    role: userObj.role,
    username: userObj.username,
    fullName: userObj.fullName,
    email: userObj.email,
    phone: userObj.phone,
    department: userObj.department,
    preferredLanguage: userObj.preferredLanguage || "en",
  };
}

function resolveToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

function attachAuth(req, res, next) {
  const token = resolveToken(req);

  if (token) {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET environment variable is not set");
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      req.user = normalizeUser({
        _id: payload.userId,
        username: payload.username,
        role: payload.role,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        department: payload.department,
        preferredLanguage: payload.preferredLanguage || "en",
      });
      req.currentUser = req.user;
      return next();
    } catch (_error) {
      return next(new AppError("Invalid or expired token", 401));
    }
  }

  if (req.session?.user) {
    req.user = normalizeUser(req.session.user);
    req.currentUser = req.user;
  }

  return next();
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
