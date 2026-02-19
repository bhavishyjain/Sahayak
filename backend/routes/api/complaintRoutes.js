const express = require("express");
const controller = require("../../controllers/api/complaintController");
const { attachAuth, requireAuth } = require("../../middlewares/jwtAuth");
const upload = require("../../middlewares/multer");

const router = express.Router();

router.use(attachAuth, requireAuth);

router.post("/", upload.single("image"), controller.createComplaint);
router.get("/", controller.myComplaints);
router.get("/:complaintId([0-9a-fA-F]{24})", controller.getComplaintById);

module.exports = router;
