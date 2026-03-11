const express = require("express");
const router = express.Router();
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const { getHodOverview, getHodWorkers, getHodWorkerById } = require("../controllers/hod/analyticsController");
const { approveCompletion, markNeedsRework, cancelComplaint, updateWorkerTask, getComplaintWorkers } = require("../controllers/hod/workflowController");
const { assignMultipleWorkers, getWorkerComplaints } = require("../controllers/hod/assignmentController");
const { inviteWorker, removeWorker, listInvitations, revokeInvitation } = require("../controllers/hod/invitationController");

router.use(attachAuth, requireAuth, authorize("head"));

router.get("/overview", getHodOverview);
router.get("/workers", getHodWorkers);
router.get("/workers/:workerId", getHodWorkerById);
router.get("/workers/:workerId/complaints", getWorkerComplaints);
router.post("/invite-worker", inviteWorker);
router.get("/invitations", listInvitations);
router.delete("/invitations/:invitationId", revokeInvitation);
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
