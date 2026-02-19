const express = require("express");
const router = express.Router();
const complaintController = require("../controllers/complaintController");
const { isAuthenticated } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/multer");

// Unified endpoint which accepts raw text and either creates complaint or returns status
// POST body: { rawText: string, lat?: number, lng?: number }
router.post(
  "/process",
  isAuthenticated,
  complaintController.processRawComplaint
);

router.post("/confirm", isAuthenticated, complaintController.confirmComplaint);

// New endpoint for form-based complaint submission (no authentication required)
// POST body: { title, description, category, location, landmark?, contactName?, contactPhone?, contactEmail?, coordinates }
router.post(
  "/submit",
  upload.array("files", 10),
  complaintController.submitComplaint
);

// helper endpoints
router.get(
  "/ticket/:ticketId",
  isAuthenticated,
  complaintController.getComplaintByTicket
);
router.get("/last", isAuthenticated, complaintController.getLastComplaint);

// Get all complaints for heatmap
router.get("/all", complaintController.getAllComplaints);

// Get user's own complaints
router.get("/my", isAuthenticated, complaintController.getMyComplaints);

// Update complaint
router.put("/:id", isAuthenticated, complaintController.updateComplaint);

module.exports = router;
