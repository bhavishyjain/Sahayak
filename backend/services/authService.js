const jwt = require("jsonwebtoken");

function issueToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      preferredLanguage: user.preferredLanguage || "en",
    },
    process.env.JWT_SECRET || "api_dev_secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
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
  };

  if (user.role === "worker") {
    payload.rating = user.rating || 4.5;
    payload.performanceMetrics = user.performanceMetrics || {
      totalCompleted: 0,
      averageCompletionTime: 0,
      currentWeekCompleted: 0,
      customerRating: 4.5,
    };
  }

  return payload;
}

module.exports = {
  issueToken,
  buildUserPayload,
};
