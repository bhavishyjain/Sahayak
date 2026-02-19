const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middlewares/authMiddleware");
const {
  getDashboardStats,
  getRecentComplaints,
  getWorkerStats,
} = require("../controllers/dashboardController");

// Dashboard statistics
router.get("/stats", isAuthenticated, getDashboardStats);

// Recent complaints for dashboard
router.get("/recent-complaints", isAuthenticated, getRecentComplaints);

// Worker statistics for dashboard
router.get("/workers", isAuthenticated, getWorkerStats);

module.exports = router;
