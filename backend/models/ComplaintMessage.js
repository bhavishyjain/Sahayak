const mongoose = require("mongoose");
const { ROLES } = require("../domain/constants");

const complaintMessageSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderName: { type: String, required: true },
    senderRole: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
    },
    text: { type: String, required: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

complaintMessageSchema.index({ complaintId: 1, createdAt: 1 });

module.exports = mongoose.model("ComplaintMessage", complaintMessageSchema);
