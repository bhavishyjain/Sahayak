const express = require("express");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const upload = require("../middlewares/multer");
const { createComplaint, myComplaints, getNearbyComplaints, getComplaintById, upvoteComplaint, submitFeedback } = require("../controllers/complaints/createReadController");
const { getComplaintsNeedingReview, applyAISuggestion } = require("../controllers/complaints/aiReviewController");
const { uploadCompletionPhotos } = require("../controllers/complaints/mediaController");
const { voteSatisfaction, getSatisfactionVotes } = require("../controllers/complaints/satisfactionController");
const { getMessages, postMessage } = require("../controllers/complaints/messageController");
const {
  listAdminSpecialRequests,
  reviewSpecialRequest,
} = require("../controllers/complaints/specialRequestController");
const {
  listDeletedComplaints,
  softDeleteComplaint,
  restoreComplaint,
  hardDeleteComplaint,
  updateComplaintByAdmin,
} = require("../controllers/admin/complaintController");

const router = express.Router();

router.use(attachAuth, requireAuth);

router.post("/", upload.array("images", 5), createComplaint);
router.get("/", myComplaints);
router.get("/nearby", getNearbyComplaints);
router.get("/special-requests", authorize("admin"), listAdminSpecialRequests);
router.post(
  "/special-requests/:requestId/review",
  authorize("admin"),
  reviewSpecialRequest,
);
router.get("/:complaintId([0-9a-fA-F]{24})", getComplaintById);
router.post("/:complaintId([0-9a-fA-F]{24})/upvote", upvoteComplaint);
router.post("/:complaintId([0-9a-fA-F]{24})/feedback", submitFeedback);

// AI Review Routes (HOD/Admin only)
router.get("/ai-review/pending", authorize("head", "admin"), getComplaintsNeedingReview);
router.post("/:complaintId([0-9a-fA-F]{24})/apply-ai-suggestion", authorize("head", "admin"), applyAISuggestion);

// Completion Photos (Worker only)
router.post("/:id([0-9a-fA-F]{24})/completion-photos", upload.array("completionPhotos", 5), uploadCompletionPhotos);

// Satisfaction Voting (All authenticated users)
router.post("/:id([0-9a-fA-F]{24})/satisfaction-vote", voteSatisfaction);
router.get("/:id([0-9a-fA-F]{24})/satisfaction", getSatisfactionVotes);

// Comment Thread (citizen / worker / HOD / admin)
router.get("/:id([0-9a-fA-F]{24})/messages", getMessages);
router.post("/:id([0-9a-fA-F]{24})/messages", postMessage);

// Admin soft-delete management
router.get("/deleted", authorize("admin"), listDeletedComplaints);
router.put("/:complaintId([0-9a-fA-F]{24})", authorize("admin"), updateComplaintByAdmin);
router.delete("/:complaintId([0-9a-fA-F]{24})", authorize("admin"), softDeleteComplaint);
router.post("/:complaintId([0-9a-fA-F]{24})/restore", authorize("admin"), restoreComplaint);
router.delete("/:complaintId([0-9a-fA-F]{24})/purge", authorize("admin"), hardDeleteComplaint);

module.exports = router;
