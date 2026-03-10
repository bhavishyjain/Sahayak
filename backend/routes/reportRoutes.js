// routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");

// All report routes require authentication
router.use(attachAuth, requireAuth);

// Generate reports - HOD and Admin only
router.get(
  "/excel",
  authorize("head", "admin"),
  reportController.generateExcelReport,
);

router.get(
  "/pdf",
  authorize("head", "admin"),
  reportController.generatePDFReport,
);

router.get(
  "/csv",
  authorize("head", "admin"),
  reportController.generateCSVReport,
);

// Dashboard statistics - HOD and Admin only
router.get(
  "/stats",
  authorize("head", "admin"),
  reportController.getDashboardStats,
);

// Department breakdown - HOD and Admin only
router.get(
  "/department-breakdown",
  authorize("head", "admin"),
  reportController.getDepartmentBreakdown,
);

// Email reports - HOD and Admin only
router.post(
  "/email",
  authorize("head", "admin"),
  reportController.sendEmailReport,
);

router.post(
  "/schedule",
  authorize("head", "admin"),
  reportController.scheduleEmailReport,
);

router.get(
  "/schedule",
  authorize("head", "admin"),
  reportController.getSchedules,
);

router.delete(
  "/schedule/:id",
  authorize("head", "admin"),
  reportController.cancelSchedule,
);

module.exports = router;
