const express = require("express");
const router = express.Router();
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const {
  getHodDashboard,
  getHodWorkers,
  assignComplaintToWorker,
  approveCompletion,
  markNeedsRework,
  cancelComplaint,
  bulkAssignComplaints,
  getWorkerComplaints,
} = require("../controllers/hodController");

router.use(attachAuth, requireAuth, authorize("head"));

router.get("/dashboard", getHodDashboard);
router.get("/workers", getHodWorkers);
router.get("/workers/:workerId/complaints", getWorkerComplaints);
router.post("/assign-complaint", assignComplaintToWorker);

// HOD Approval Workflow
router.post(
  "/approve-completion/:complaintId",
  approveCompletion,
);
router.post(
  "/needs-rework/:complaintId",
  markNeedsRework,
);
router.post("/cancel-complaint/:complaintId", cancelComplaint);

// Bulk Operations
router.post("/bulk-assign", bulkAssignComplaints);

module.exports = router;
