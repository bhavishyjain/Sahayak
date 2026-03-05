const mongoose = require("mongoose");

const workerInvitationSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      enum: ["Road", "Water", "Electricity", "Waste", "Drainage", "Other"],
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: { type: Date, default: null },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workerInvitationSchema.index(
  { email: 1, department: 1, expiresAt: 1 },
  { name: "worker_invitation_lookup" },
);

module.exports = mongoose.model("WorkerInvitation", workerInvitationSchema);
