exports.isAuthenticated = (req, res, next) => {
  const userObj = req.user;
  if (!userObj) return res.status(401).json({ message: "Unauthorized" });

  // Normalize user onto req.user and req.currentUser
  req.user = {
    _id: userObj.id || userObj._id,
    id: userObj.id || userObj._id,
    role: userObj.role,
    username: userObj.username,
  };
  req.currentUser = req.user;
  next();
};
