const express = require("express");
const router = express.Router();
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const {
  getHodDashboard,
  getHodWorkers,
  approveCompletion,
  markNeedsRework,
  cancelComplaint,
  getWorkerComplaints,
  inviteWorker,
  removeWorker,
  assignMultipleWorkers,
  updateWorkerTask,
  getComplaintWorkers,
} = require("../controllers/hodController");

router.use(attachAuth, requireAuth, authorize("head"));

router.get("/dashboard", getHodDashboard);
router.get("/workers", getHodWorkers);
router.get("/workers/:workerId/complaints", getWorkerComplaints);
router.post("/invite-worker", inviteWorker);
router.delete("/workers/:workerId", removeWorker);

// HOD Approval Workflow
router.post("/approve-completion/:complaintId", approveCompletion);
router.post("/needs-rework/:complaintId", markNeedsRework);
router.post("/cancel-complaint/:complaintId", cancelComplaint);

// Multi-Worker Assignment
router.post("/complaints/:complaintId/assign-workers", assignMultipleWorkers);
router.put("/complaints/:complaintId/workers/:workerId", updateWorkerTask);
router.get("/complaints/:complaintId/workers", getComplaintWorkers);

module.exports = router;
