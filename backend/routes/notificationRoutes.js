const express = require("express");
const controller = require("../controllers/notificationController");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");

const router = express.Router();

router.use(attachAuth, requireAuth);
router.post("/register-token", controller.registerPushToken);
router.post("/test", controller.sendTestNotification);

module.exports = router;
