const express = require("express");
const router = express.Router();
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");
const {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} = require("../controllers/admin/festivalEventController");

// Reading events (active=true) is open to head + admin for visibility
router.get(
  "/",
  attachAuth,
  requireAuth,
  authorize("admin", "head"),
  listEvents,
);

// Mutations are admin-only
router.use(attachAuth, requireAuth, authorize("admin"));
router.post("/", createEvent);
router.patch("/:id", updateEvent);
router.delete("/:id", deleteEvent);

module.exports = router;
