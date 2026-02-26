const dotenv = require("dotenv");
dotenv.config();

const createError = require("http-errors");
const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();

connectDB();
require("./utils/eventPriorityUpdater");
const { setupSLAEscalationJob } = require("./utils/slaEscalation");
setupSLAEscalationJob();

const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:5000",
  "http://localhost:8081",
  "exp://127.0.0.1:8081",
  "exp://localhost:8081",
];
const extraOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...extraOrigins])];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "tiny"));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/api", require("./routes"));
app.use("/api/chat", require("./routes/chatRoutes"));
app.use("/api/workers", require("./routes/workerRoutes"));
app.use("/api/hod", require("./routes/hodRoutes"));

app.use(function notFound(req, res, next) {
  next(createError(404, "Route not found"));
});

app.use(function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  return res.status(status).json({
    message: err.message || "Internal server error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

module.exports = app;
