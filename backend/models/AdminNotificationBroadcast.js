const mongoose = require("mongoose");
const { ROLES } = require("../domain/constants");

const adminNotificationBroadcastSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    audienceLabel: {
      type: String,
      default: "All active users",
      trim: true,
    },
    recipientRoles: [
      {
        type: String,
        enum: Object.values(ROLES),
      },
    ],
    recipientCount: { type: Number, default: 0 },
    deliveredCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    pushSentCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["sent", "partial", "failed"],
      default: "sent",
    },
  },
  { timestamps: true },
);

adminNotificationBroadcastSchema.index({ createdAt: -1 });

module.exports = mongoose.model(
  "AdminNotificationBroadcast",
  adminNotificationBroadcastSchema,
);
