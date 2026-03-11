const mongoose = require("mongoose");

const complaintSlaSchema = new mongoose.Schema(
  {
    dueDate: { type: Date, default: null },
    isOverdue: { type: Boolean, default: false },
    escalated: { type: Boolean, default: false },
    escalationLevel: { type: Number, default: 0 },
    lastEscalatedAt: { type: Date, default: null },
    escalationHistory: [
      {
        level: Number,
        escalatedAt: Date,
        escalatedTo: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  { _id: false },
);

module.exports = complaintSlaSchema;
