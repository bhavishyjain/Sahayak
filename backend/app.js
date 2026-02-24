const dotenv = require("dotenv");
dotenv.config();

const createError = require("http-errors");
const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("passport");
const connectDB = require("./config/db");

const app = express();

connectDB();
require("./utils/eventPriorityUpdater");

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
  })
);

if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "tiny"));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "hackathon_secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    name: "connect.sid",
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

require("./config/passport")(passport);
app.use(passport.initialize());
app.use(passport.session());
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
