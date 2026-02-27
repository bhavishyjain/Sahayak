const express = require("express");
const router = express.Router();
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const {
  getHodDashboard,
  getHodWorkers,
  assignComplaintToWorker,
  approveCompletion,
  rejectCompletion,
  bulkAssignComplaints,
  getWorkerComplaints,
} = require("../controllers/hodController");

router.get("/dashboard", attachAuth, requireAuth, getHodDashboard);
router.get("/workers", attachAuth, requireAuth, getHodWorkers);
router.get(
  "/workers/:workerId/complaints",
  attachAuth,
  requireAuth,
  getWorkerComplaints,
);
router.post(
  "/assign-complaint",
  attachAuth,
  requireAuth,
  assignComplaintToWorker,
);

// HOD Approval Workflow
router.post(
  "/approve-completion/:complaintId",
  attachAuth,
  requireAuth,
  approveCompletion,
);
router.post(
  "/reject-completion/:complaintId",
  attachAuth,
  requireAuth,
  rejectCompletion,
);

// Bulk Operations
router.post("/bulk-assign", attachAuth, requireAuth, bulkAssignComplaints);

module.exports = router;
