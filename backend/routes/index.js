const express = require("express");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "sahayak-api" });
});

router.use("/auth", require("./authRoutes"));
router.use("/complaints", require("./complaintRoutes"));
router.use("/dashboard", require("./dashboardRoutes"));
router.use("/notifications", require("./notificationRoutes"));
router.use("/chat", require("./chatRoutes"));
router.use("/workers", require("./workerRoutes"));
router.use("/hod", require("./hodRoutes"));
router.use("/users", require("./users"));
router.use("/reports", require("./reportRoutes"));

module.exports = router;
