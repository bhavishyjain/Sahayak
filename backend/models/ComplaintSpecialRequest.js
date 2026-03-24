const mongoose = require("mongoose");

const complaintSpecialRequestSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    ticketId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    requestType: {
      type: String,
      enum: ["update", "delete"],
      required: true,
      index: true,
    },
    currentDepartment: {
      type: String,
      required: true,
      trim: true,
    },
    requestedDepartment: {
      type: String,
      trim: true,
      default: null,
    },
    currentPriority: {
      type: String,
      required: true,
      trim: true,
    },
    requestedPriority: {
      type: String,
      trim: true,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

complaintSpecialRequestSchema.index(
  { complaintId: 1, status: 1 },
  { name: "complaint_special_request_pending_lookup" },
);

module.exports = mongoose.model(
  "ComplaintSpecialRequest",
  complaintSpecialRequestSchema,
);
