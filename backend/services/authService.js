const jwt = require("jsonwebtoken");

function issueToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return jwt.sign(
    {
      userId: user._id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      department: user.department,
      preferredLanguage: user.preferredLanguage || "en",
    },
    process.env.JWT_SECRET,
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
