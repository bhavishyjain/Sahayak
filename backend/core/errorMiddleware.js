const AppError = require("./AppError");

function notFound(_req, _res, next) {
  next(new AppError("Route not found", 404));
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const isOperational = err instanceof AppError || err.isOperational;

  if (!isOperational && process.env.NODE_ENV !== "test") {
    console.error("Unexpected error:", err);
  }

  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    ...(err.details || {}),
    details: err.details || undefined,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
}

module.exports = {
  notFound,
  errorHandler,
};
