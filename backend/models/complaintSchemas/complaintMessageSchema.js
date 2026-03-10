const mongoose = require("mongoose");

const complaintMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: { type: String, required: true },
    senderRole: {
      type: String,
      enum: ["user", "worker", "head", "admin"],
      required: true,
    },
    text: { type: String, required: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

module.exports = complaintMessageSchema;
