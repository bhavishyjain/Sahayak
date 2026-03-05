const mongoose = require("mongoose");

const complaintSatisfactionVotesSchema = new mongoose.Schema(
  {
    thumbsUp: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    thumbsDown: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    thumbsUpCount: { type: Number, default: 0 },
    thumbsDownCount: { type: Number, default: 0 },
  },
  { _id: false },
);

module.exports = complaintSatisfactionVotesSchema;
