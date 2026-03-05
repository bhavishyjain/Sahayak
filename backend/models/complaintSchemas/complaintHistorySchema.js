const mongoose = require("mongoose");

const complaintHistorySchema = new mongoose.Schema(
  {
    status: String,
    updatedBy: {
      type: mongoose.Schema.Types.Mixed,
      ref: "User",
      default: null,
    },
    timestamp: { type: Date, default: Date.now },
    note: String,
  },
  { _id: false },
);

module.exports = complaintHistorySchema;
