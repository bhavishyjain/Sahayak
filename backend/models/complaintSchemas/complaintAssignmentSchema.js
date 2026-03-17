const mongoose = require("mongoose");

const complaintAssignmentSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedAt: { type: Date, default: Date.now },
    taskDescription: { type: String, default: null },
    status: {
      type: String,
      enum: ["assigned", "in-progress", "completed", "needs-rework"],
      default: "assigned",
    },
    isLeader: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

module.exports = complaintAssignmentSchema;
