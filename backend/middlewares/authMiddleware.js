exports.isAuthenticated = (req, res, next) => {
  const userObj = req.session?.user || req.user;
  if (!userObj) return res.status(401).json({ message: "Unauthorized" });

  // Normalize user onto req.user for backward compatibility
  req.user = {
    _id: userObj.id || userObj._id,
    id: userObj.id || userObj._id,
    role: userObj.role,
    username: userObj.username,
  };

  // Also set req.currentUser for convenience
  req.currentUser = req.user;
  next();
};

// Ensure user has required role(s)
exports.ensureRole =
  (...roles) =>
  (req, res, next) => {
    if (req.session?.user && roles.includes(req.session.user.role))
      return next();
    return res.status(403).json({ message: "Forbidden" });
  };

exports.isHoD = (req, res, next) => {
  if (!req.currentUser || req.currentUser.role !== "head") {
    return res.status(403).json({ message: "Forbidden: Only HoD allowed" });
  }
  next();
};
