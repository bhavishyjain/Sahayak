const express = require("express");
const controller = require("../../controllers/api/authController");
const { attachAuth, requireAuth } = require("../../middlewares/jwtAuth");

const router = express.Router();

router.post("/register", controller.register);
router.post("/login", controller.login);
router.get("/me", attachAuth, requireAuth, controller.me);
router.put("/me", attachAuth, requireAuth, controller.updateMe);

module.exports = router;
