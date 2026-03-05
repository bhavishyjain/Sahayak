const mongoose = require("mongoose");

const complaintAiAnalysisSchema = new mongoose.Schema(
  {
    department: {
      type: String,
      enum: ["Road", "Water", "Electricity", "Waste", "Drainage", "Other"],
      default: null,
    },
    confidence: { type: Number, min: 0, max: 1, default: null },
    sentiment: {
      type: String,
      enum: ["calm", "frustrated", "angry", "desperate", "unknown"],
      default: "unknown",
    },
    urgency: { type: Number, min: 1, max: 10, default: 5 },
    keywords: [{ type: String }],
    affectedCount: { type: Number, default: 1 },
    suggestedPriority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: null,
    },
    reasoning: { type: String, default: null },
  },
  { _id: false },
);

module.exports = complaintAiAnalysisSchema;
