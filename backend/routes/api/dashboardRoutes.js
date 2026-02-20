const express = require("express");
const controller = require("../../controllers/api/dashboardController");
const { attachAuth, requireAuth } = require("../../middlewares/jwtAuth");

const router = express.Router();

router.get("/summary", attachAuth, requireAuth, controller.summary);
router.get("/heatmap", attachAuth, requireAuth, controller.heatmap);

module.exports = router;
