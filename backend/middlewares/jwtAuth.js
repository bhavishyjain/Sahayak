const jwt = require("jsonwebtoken");

function normalizeUser(userObj) {
  return {
    _id: userObj.id || userObj._id,
    id: userObj.id || userObj._id,
    role: userObj.role,
    username: userObj.username,
    fullName: userObj.fullName,
    email: userObj.email,
    phone: userObj.phone,
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
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "api_dev_secret"
      );

      req.user = normalizeUser({
        _id: payload.userId,
        username: payload.username,
        role: payload.role,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        preferredLanguage: payload.preferredLanguage || "en",
      });
      req.currentUser = req.user;
      return next();
    } catch (_error) {
      return res.status(401).json({ message: "Invalid or expired token" });
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
    return res.status(401).json({ message: "Authentication required" });
  }
  return next();
}

module.exports = {
  attachAuth,
  requireAuth,
};
