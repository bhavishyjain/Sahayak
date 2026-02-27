const express = require("express");
const router = express.Router();
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const upload = require("../middlewares/multer");
const {
  createWorker,
  updateWorker,
  getAllWorkers,
  getAvailableWorkers,
  assignComplaint,
  updateWorkerStatus,
  getWorkerDashboard,
  updateComplaintStatus,
  getAssignedComplaints,
  getCompletedComplaints,
  getLeaderboard,
} = require("../controllers/workerController");

// Admin routes for worker management
router.post("/create", attachAuth, requireAuth, createWorker);
router.put("/:workerId", attachAuth, requireAuth, updateWorker);
router.get("/", attachAuth, requireAuth, getAllWorkers);
router.get(
  "/available/:department",
  attachAuth,
  requireAuth,
  getAvailableWorkers,
);
router.post("/assign-complaint", attachAuth, requireAuth, assignComplaint);

// Worker routes
router.get("/dashboard", attachAuth, requireAuth, getWorkerDashboard);
router.get(
  "/assigned-complaints",
  attachAuth,
  requireAuth,
  getAssignedComplaints,
);
router.get(
  "/completed-complaints",
  attachAuth,
  requireAuth,
  getCompletedComplaints,
);
router.get("/leaderboard", attachAuth, requireAuth, getLeaderboard);
router.put("/status/:workerId", attachAuth, requireAuth, updateWorkerStatus);
router.put(
  "/complaint/:complaintId/status",
  attachAuth,
  requireAuth,
  upload.array("completionPhotos", 5),
  updateComplaintStatus,
);

module.exports = router;
