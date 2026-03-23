const AppError = require("../core/AppError");
const { getDepartmentNames } = require("../services/departmentService");

const VALID_PRIORITIES = ["Low", "Medium", "High"];

async function validateCreateComplaint({ body, coordinates, files }) {
  const required = [
    "title",
    "description",
    "department",
    "locationName",
    "priority",
  ];
  const missing = required.filter(
    (field) => !String(body?.[field] || "").trim(),
  );

  if (missing.length > 0) {
    throw new AppError(
      "title, description, department, priority and locationName are required",
      400,
      { missing },
    );
  }

  const validDepartments = await getDepartmentNames();
  if (!validDepartments.includes(String(body.department).trim())) {
    throw new AppError("Invalid department value", 400, {
      allowed: validDepartments,
    });
  }

  if (!VALID_PRIORITIES.includes(String(body.priority).trim())) {
    throw new AppError("Invalid priority value", 400, {
      allowed: VALID_PRIORITIES,
    });
  }

  if (!coordinates) {
    throw new AppError(
      "coordinates are required and must include valid lat and lng",
      400,
    );
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError("At least one proof image is required", 400);
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
