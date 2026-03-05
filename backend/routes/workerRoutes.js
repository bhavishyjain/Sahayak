const express = require("express");
const router = express.Router();
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const upload = require("../middlewares/multer");
const {
  createWorker,
  updateWorker,
  getAllWorkers,
  getAvailableWorkers,
  updateWorkerStatus,
  getWorkerDashboard,
  updateComplaintStatus,
  getAssignedComplaints,
  getCompletedComplaints,
  getLeaderboard,
} = require("../controllers/workerController");

router.use(attachAuth, requireAuth);

// Admin routes for worker management
router.post("/create", authorize("admin"), createWorker);
router.put("/:workerId", authorize("admin"), updateWorker);
router.get("/", authorize("admin", "head"), getAllWorkers);
router.get("/available/:department", authorize("admin", "head"), getAvailableWorkers);

// Worker routes
router.get("/dashboard", authorize("worker", "admin"), getWorkerDashboard);
router.get("/assigned-complaints", authorize("worker", "admin"), getAssignedComplaints);
router.get("/completed-complaints", authorize("worker", "admin"), getCompletedComplaints);
router.get("/leaderboard", authorize("worker", "admin", "head"), getLeaderboard);
router.put("/status/:workerId", authorize("worker", "admin"), updateWorkerStatus);
router.put(
  "/complaint/:complaintId/status",
  authorize("worker", "admin"),
  upload.array("completionPhotos", 5),
  updateComplaintStatus,
);

module.exports = router;
