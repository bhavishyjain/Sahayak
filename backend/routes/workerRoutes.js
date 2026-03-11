const express = require("express");
const router = express.Router();
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const upload = require("../middlewares/multer");
const { createWorker, updateWorker, getAllWorkers, getAvailableWorkers } = require("../controllers/worker/assignmentController");
const { getWorkerOverview, getAssignedComplaints, getCompletedComplaints, getLeaderboard, getWorkerAnalytics } = require("../controllers/worker/analyticsController");
const { updateComplaintStatus } = require("../controllers/worker/statusController");

router.use(attachAuth, requireAuth);

// Admin routes for worker management
router.post("/create", authorize("admin"), createWorker);
router.put("/:workerId", authorize("admin"), updateWorker);
router.get("/", authorize("admin", "head"), getAllWorkers);
router.get("/available/:department", authorize("admin", "head"), getAvailableWorkers);

// Worker routes
router.get("/overview", authorize("worker", "admin"), getWorkerOverview);
router.get("/assigned-complaints", authorize("worker", "admin"), getAssignedComplaints);
router.get("/completed-complaints", authorize("worker", "admin"), getCompletedComplaints);
router.get("/leaderboard", authorize("worker", "admin", "head"), getLeaderboard);
router.get("/analytics", authorize("worker", "admin", "head"), getWorkerAnalytics);
router.put(
  "/complaint/:complaintId/status",
  authorize("worker", "admin"),
  upload.array("completionPhotos", 5),
  updateComplaintStatus,
);

module.exports = router;
