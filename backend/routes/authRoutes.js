const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("../controllers/authController");
const { attachAuth, requireAuth } = require("../middlewares/jwtAuth");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts, please try again later",
  },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many refresh attempts, please try again later",
  },
});

router.post("/register", authLimiter, controller.register);
router.post("/login", authLimiter, controller.login);
router.post("/refresh", refreshLimiter, controller.refresh);
router.post("/logout", attachAuth, controller.logout);
router.get("/me", attachAuth, requireAuth, controller.me);
router.put("/me", attachAuth, requireAuth, controller.updateMe);
router.post("/accept-invite", attachAuth, requireAuth, controller.acceptInvite);
router.delete("/me", attachAuth, requireAuth, controller.deleteMe);

// Password reset (public, rate-limited)
router.post("/forgot-password", authLimiter, controller.forgotPassword);
router.post("/reset-password/:token", authLimiter, controller.resetPassword);

// Email verification
router.get("/verify-email/:token", controller.verifyEmail);
router.post(
  "/resend-verification",
  authLimiter,
  attachAuth,
  requireAuth,
  controller.resendVerification,
);

module.exports = router;
