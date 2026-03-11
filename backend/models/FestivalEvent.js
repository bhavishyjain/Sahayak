const mongoose = require("mongoose");

const festivalEventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    endDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    highPriorityLocations: [{ type: String, trim: true }],
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "High",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("FestivalEvent", festivalEventSchema);
