const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./core/errorMiddleware");

const app = express();

connectDB();
require("./utils/eventPriorityUpdater");
const { setupSLAEscalationJob } = require("./utils/slaEscalation");
setupSLAEscalationJob();

// Self-ping cron job to keep Render service alive
const cron = require("node-cron");
const axios = require("axios");

if (process.env.SELF_PING_URL) {
  cron.schedule("*/14 * * * *", async () => {
    try {
      await axios.get(process.env.SELF_PING_URL);
      console.log("✅ Self ping successful");
    } catch (err) {
      console.log("❌ Self ping failed:", err.message);
    }
  });
  console.log("🔄 Self-ping cron job started (every 14 minutes)");
}

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
app.use(notFound);
app.use(errorHandler);

module.exports = app;
