const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const { notFound, errorHandler } = require("./core/errorMiddleware");

const app = express();

// Trust reverse-proxy headers (needed for correct IP in rate limiting)
app.set("trust proxy", 1);
app.use(helmet());

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

const isProd = process.env.NODE_ENV === "production";

const devOrigins = [
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
// In production only allow explicitly configured origins
const allowedOrigins = isProd
  ? extraOrigins
  : [...new Set([...devOrigins, ...extraOrigins])];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser requests (mobile apps, Postman, server-to-server)
      // which typically do not send an Origin header.
      if (!origin) return cb(null, true);
      if (origin && allowedOrigins.includes(origin)) return cb(null, true);
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
// Strip MongoDB operators ($, .) from user-supplied query/body keys
app.use(mongoSanitize());

app.get("/.well-known/apple-app-site-association", (_req, res) => {
  const iosAppId =
    process.env.IOS_APP_APPLE_ID || "ZLV8X465V5.com.sahayak.mobile";

  res.setHeader("Content-Type", "application/json");
  res.send({
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [iosAppId],
          paths: [
            "/accept-invite",
            "/verify-email",
            "/reset-password",
            "/complaints/complaint-details",
          ],
        },
      ],
    },
  });
});

app.get("/.well-known/assetlinks.json", (_req, res) => {
  const packageName = process.env.ANDROID_APP_PACKAGE || "com.sahayak.mobile";
  const fingerprints = String(process.env.ANDROID_APP_SHA256_CERT_FINGERPRINTS)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  res.setHeader("Content-Type", "application/json");
  res.send(
    fingerprints.map((fingerprint) => ({
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: [fingerprint],
      },
    })),
  );
});

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildDeepLinkUrl(pathname, query = {}) {
  const normalizedPath = String(pathname || "").replace(/^\/+/, "");
  const url = new URL(`sahayak://${normalizedPath}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function renderDeepLinkBridgePage({ deepLinkUrl }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sahayak</title>
    <style>
      body { margin: 0; background: #f9fafb; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; }
      .card { max-width: 420px; margin: 64px auto; background: #fff; border-radius: 6px; padding: 32px; border: 1px solid #e5e7eb; text-align: center; }
      h1 { margin: 0 0 12px; font-size: 20px; font-weight: 600; }
      p { margin: 0 0 24px; color: #6b7280; font-size: 14px; }
      .btn { display: inline-block; text-decoration: none; border-radius: 4px; padding: 10px 24px; font-weight: 600; font-size: 14px; }
      .btn-primary { background: #1f2937; color: #fff; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Redirecting...</h1>
      <p>If the app does not open automatically, tap the button below.</p>
      <a class="btn btn-primary" href="${escapeHtml(deepLinkUrl)}">Open App</a>
    </div>
    <script>
      setTimeout(() => {
        window.location.replace(${JSON.stringify(deepLinkUrl)});
      }, 100);
    </script>
  </body>
</html>`;
}

app.get(
  [
    "/home",
    "/accept-invite",
    "/verify-email",
    "/reset-password",
    "/complaints/complaint-details",
  ],
  (req, res) => {
    const deepLinkUrl = buildDeepLinkUrl(req.path, req.query || {});

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderDeepLinkBridgePage({ deepLinkUrl }));
  },
);

app.get("/ping", (_req, res) => res.status(200).send("pong"));

app.use("/api", require("./routes"));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
