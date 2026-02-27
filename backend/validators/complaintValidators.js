const AppError = require("../core/AppError");

function validateCreateComplaint(body) {
  const required = ["title", "description", "department", "locationName"];
  const missing = required.filter((field) => !String(body?.[field] || "").trim());
  if (missing.length > 0) {
    throw new AppError(
      "title, description, department and locationName are required",
      400,
      { missing },
    );
  }
}

function validateFeedbackBody(body) {
  const rating = Number(body?.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new AppError("Rating must be between 1 and 5", 400);
  }
}

module.exports = {
  validateCreateComplaint,
  validateFeedbackBody,
};
