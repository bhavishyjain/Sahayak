const express = require("express");
const controller = require("../controllers/notificationController");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");
const authorize = require("../middlewares/authorize");

const router = express.Router();

router.use(attachAuth, requireAuth);
router.post("/register-token", controller.registerPushToken);
router.get(
  "/admin-broadcasts",
  authorize("admin"),
  controller.getAdminBroadcastHistory,
);
router.post(
  "/admin-broadcasts",
  authorize("admin"),
  controller.createAdminBroadcast,
);
router.get("/history", controller.getHistory);
router.put("/read-all", controller.markAllRead);
router.put("/:id/read", controller.markRead);
router.get("/preferences", controller.getPreferences);
router.put("/preferences", controller.updatePreferences);

module.exports = router;
