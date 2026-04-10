const mongoose = require("mongoose");

const invitationSchema = new mongoose.Schema(
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
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["worker", "head"],
      default: "worker",
      index: true,
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
  {
    timestamps: true,
    // Keep existing collection so no data migration is required.
    collection: "workerinvitations",
  },
);

invitationSchema.index(
  { email: 1, department: 1, role: 1, expiresAt: 1 },
  { name: "worker_invitation_lookup" },
);

module.exports = mongoose.model("Invitation", invitationSchema);
