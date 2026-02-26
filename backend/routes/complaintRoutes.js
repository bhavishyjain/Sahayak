const express = require("express");
const controller = require("../controllers/complaintController");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const upload = require("../middlewares/multer");

const router = express.Router();

router.use(attachAuth, requireAuth);

router.post("/", upload.array("images", 5), controller.createComplaint);
router.get("/", controller.myComplaints);
router.get("/:complaintId([0-9a-fA-F]{24})", controller.getComplaintById);
router.post(
  "/:complaintId([0-9a-fA-F]{24})/upvote",
  controller.upvoteComplaint,
);
router.post(
  "/:complaintId([0-9a-fA-F]{24})/feedback",
  controller.submitFeedback,
);

module.exports = router;
