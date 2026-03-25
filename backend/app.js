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

function renderDeepLinkBridgePage({ deepLinkUrl, webUrl }) {
  const safeDeepLink = escapeHtml(deepLinkUrl);
  const safeWebUrl = escapeHtml(webUrl);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Open Sahayak</title>
    <style>
      body { margin: 0; background: #f3f4f6; color: #111827; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; }
      .card { max-width: 560px; margin: 48px auto; background: #fff; border-radius: 14px; padding: 22px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1); }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0 0 14px; color: #4b5563; }
      .btn { display: inline-block; margin-top: 8px; margin-right: 8px; text-decoration: none; border-radius: 10px; padding: 12px 16px; font-weight: 600; }
      .btn-primary { background: #111827; color: #fff; }
      .btn-secondary { background: #e5e7eb; color: #111827; }
      .meta { margin-top: 12px; font-size: 12px; color: #6b7280; word-break: break-all; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Opening Sahayak</h1>
      <p>If the app does not open automatically, tap Open App.</p>
      <a class="btn btn-primary" href="${safeDeepLink}">Open App</a>
      <a class="btn btn-secondary" href="${safeWebUrl}">Open in Browser</a>
      <div class="meta">Deep link: ${safeDeepLink}</div>
    </div>
    <script>
      window.location.replace(${JSON.stringify(deepLinkUrl)});
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
    const webBase = String(
      process.env.APP_LINK_BASE_URL || "https://sahayak-zqp7.onrender.com",
    )
      .trim()
      .replace(/\/+$/, "");
    const webUrl = `${webBase}${req.originalUrl}`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderDeepLinkBridgePage({ deepLinkUrl, webUrl }));
  },
);

app.get("/ping", (_req, res) => res.status(200).send("pong"));

app.use("/api", require("./routes"));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
