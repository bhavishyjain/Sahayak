const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["user", "head", "worker", "admin"],
    default: "user",
  },
  department: {
    type: String,
    default: "Other",
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: { type: String, required: true, unique: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  lastActive: { type: Date, default: Date.now },
  // Tokens issued before this time are rejected (used for forced logout / password reset)
  tokenValidFrom: { type: Date, default: Date.now },

  // Email verification
  emailVerified: { type: Boolean, default: false },
  emailVerificationTokenHash: { type: String, default: null },
  emailVerificationExpires: { type: Date, default: null },

  // Password reset
  passwordResetTokenHash: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },

  // Hashed refresh tokens — one entry per active device/session (capped at 10)
  refreshTokens: [
    {
      tokenHash: { type: String, required: true },
      expiresAt: { type: Date, required: true },
      _id: false,
    },
  ],

  // Worker-specific fields
  workLocation: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
  },
  rating: { type: Number, default: null, min: 0, max: 5 },
  performanceMetrics: {
    totalCompleted: { type: Number, default: 0 },
    averageCompletionTime: { type: Number, default: 0 }, // in hours
    currentWeekCompleted: { type: Number, default: 0 },
    customerRating: { type: Number, default: null },
  },
  pushTokens: [{ type: String }],
  notificationPreferences: {
    complaintsUpdates: { type: Boolean, default: true },
    assignments: { type: Boolean, default: true },
    escalations: { type: Boolean, default: true },
    systemAlerts: { type: Boolean, default: true },
    specialRequests: { type: Boolean, default: true },
    deletedComplaints: { type: Boolean, default: true },
  },
  preferredLanguage: {
    type: String,
    enum: ["en", "hi", "mr", "gu", "ta", "te", "bn", "kn", "ml", "pa", "ur"],
    default: "en",
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update the updatedAt field before saving
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

userSchema.index({ role: 1, department: 1, isActive: 1 });

module.exports = mongoose.model("User", userSchema);
