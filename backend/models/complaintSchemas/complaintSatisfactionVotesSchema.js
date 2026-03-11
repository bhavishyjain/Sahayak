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
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

complaintSatisfactionVotesSchema.virtual("thumbsUpCount").get(function () {
  return this.thumbsUp ? this.thumbsUp.length : 0;
});

complaintSatisfactionVotesSchema.virtual("thumbsDownCount").get(function () {
  return this.thumbsDown ? this.thumbsDown.length : 0;
});

module.exports = complaintSatisfactionVotesSchema;
