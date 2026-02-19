const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middlewares/authMiddleware");
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
} = require("../controllers/workerController");

// Admin routes for worker management
router.post("/create", isAuthenticated, createWorker);
router.put("/:workerId", isAuthenticated, updateWorker);
router.get("/", isAuthenticated, getAllWorkers);
router.get("/available/:department", isAuthenticated, getAvailableWorkers);
router.post("/assign-complaint", isAuthenticated, assignComplaint);

// Worker routes
router.get("/dashboard", isAuthenticated, getWorkerDashboard);
router.put("/status/:workerId", isAuthenticated, updateWorkerStatus);
router.put(
  "/complaint/:complaintId/status",
  isAuthenticated,
  upload.array("completionPhotos", 5),
  updateComplaintStatus
);

module.exports = router;
