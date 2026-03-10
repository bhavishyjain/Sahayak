const express = require("express");

const router = express.Router();

router.use("/auth", require("./authRoutes"));
router.use("/complaints", require("./complaintRoutes"));
router.use("/analytics", require("./analyticsRoutes"));
router.use("/notifications", require("./notificationRoutes"));
router.use("/chat", require("./chatRoutes"));
router.use("/workers", require("./workerRoutes"));
router.use("/hod", require("./hodRoutes"));
router.use("/users", require("./users"));
router.use("/reports", require("./reportRoutes"));

module.exports = router;
