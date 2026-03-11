const AppError = require("../core/AppError");

function requireFields(payload, fields) {
  const missing = fields.filter((field) => !String(payload?.[field] || "").trim());
  if (missing.length > 0) {
    throw new AppError(`${missing.join(", ")} are required`, 400);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function validateRegisterBody(body) {
  requireFields(body, ["username", "password", "fullName", "email", "phone"]);

  if (!EMAIL_RE.test(String(body.email || "").trim())) {
    throw new AppError("Invalid email address", 400);
  }

  if (!PASSWORD_RE.test(String(body.password || ""))) {
    throw new AppError(
      "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a digit",
      400,
    );
  }
}

function validateLoginBody(body) {
  requireFields(body, ["loginId", "password"]);
}

module.exports = {
  validateRegisterBody,
  validateLoginBody,
};
