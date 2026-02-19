const express = require("express");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "sahayak-api" });
});

router.use("/auth", require("./authRoutes"));
router.use("/complaints", require("./complaintRoutes"));
router.use("/dashboard", require("./dashboardRoutes"));
router.use("/notifications", require("./notificationRoutes"));

module.exports = router;
