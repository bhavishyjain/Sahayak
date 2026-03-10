const express = require("express");
const controller = require("../controllers/complaintController");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const upload = require("../middlewares/multer");

const router = express.Router();

router.use(attachAuth, requireAuth);

router.post("/", upload.array("images", 5), controller.createComplaint);
router.get("/", controller.myComplaints);
router.get("/nearby", controller.getNearbyComplaints);
router.get("/:complaintId([0-9a-fA-F]{24})", controller.getComplaintById);
router.post(
  "/:complaintId([0-9a-fA-F]{24})/upvote",
  controller.upvoteComplaint,
);
router.post(
  "/:complaintId([0-9a-fA-F]{24})/feedback",
  controller.submitFeedback,
);

// AI Review Routes (HOD/Admin only)
router.get(
  "/ai-review/pending",
  authorize("head", "admin"),
  controller.getComplaintsNeedingReview,
);
router.post(
  "/:complaintId([0-9a-fA-F]{24})/apply-ai-suggestion",
  authorize("head", "admin"),
  controller.applyAISuggestion,
);

// Completion Photos (Worker only)
router.post(
  "/:id([0-9a-fA-F]{24})/completion-photos",
  upload.array("completionPhotos", 10),
  controller.uploadCompletionPhotos,
);

// Satisfaction Voting (All authenticated users)
router.post(
  "/:id([0-9a-fA-F]{24})/satisfaction-vote",
  controller.voteSatisfaction,
);
router.get(
  "/:id([0-9a-fA-F]{24})/satisfaction",
  controller.getSatisfactionVotes,
);

// Comment Thread (citizen / worker / HOD / admin)
router.get("/:id([0-9a-fA-F]{24})/messages", controller.getMessages);
router.post("/:id([0-9a-fA-F]{24})/messages", controller.postMessage);

module.exports = router;
