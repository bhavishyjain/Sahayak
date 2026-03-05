const mongoose = require("mongoose");

const complaintFeedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 1, max: 5, default: null },
    comment: { type: String, default: null },
    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    ratedAt: { type: Date, default: null },
  },
  { _id: false },
);

module.exports = complaintFeedbackSchema;
