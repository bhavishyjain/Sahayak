const express = require("express");
const router = express.Router();
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const {
  getHodDashboard,
  getHodWorkers,
  assignComplaintToWorker,
} = require("../controllers/hodController");

router.get("/dashboard", attachAuth, requireAuth, getHodDashboard);
router.get("/workers", attachAuth, requireAuth, getHodWorkers);
router.post(
  "/assign-complaint",
  attachAuth,
  requireAuth,
  assignComplaintToWorker,
);

module.exports = router;
