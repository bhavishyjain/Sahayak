const express = require("express");
const controller = require("../controllers/analyticsController");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");

const router = express.Router();

router.use(attachAuth, requireAuth);
router.get("/summary", controller.summary);
router.get("/heatmap", controller.heatmap);

module.exports = router;
