const AppError = require("../core/AppError");

function requireFields(payload, fields) {
  const missing = fields.filter((field) => !String(payload?.[field] || "").trim());
  if (missing.length > 0) {
    throw new AppError(`${missing.join(", ")} are required`, 400);
  }
}

function validateRegisterBody(body) {
  requireFields(body, ["username", "password", "fullName", "email", "phone"]);
}

function validateLoginBody(body) {
  requireFields(body, ["loginId", "password"]);
}

module.exports = {
  validateRegisterBody,
  validateLoginBody,
};
