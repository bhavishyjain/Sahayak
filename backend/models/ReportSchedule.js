const mongoose = require("mongoose");

const reportScheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      required: true,
    },
    format: {
      type: String,
      enum: ["pdf", "excel", "csv"],
      required: true,
      default: "pdf",
    },
    cronExpression: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      default: "all",
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timezone: {
      type: String,
      default: process.env.REPORT_SCHEDULE_TIMEZONE || "Asia/Kolkata",
    },
    hour: {
      type: Number,
      default: 9,
      min: 0,
      max: 23,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSentAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    lastErrorStage: {
      type: String,
      enum: ["generation", "delivery", null],
      default: null,
    },
  },
  { timestamps: true },
);

reportScheduleSchema.index(
  {
    userId: 1,
    email: 1,
    frequency: 1,
    format: 1,
    department: 1,
    isActive: 1,
  },
  {
    name: "active_schedule_lookup",
  },
);

module.exports = mongoose.model("ReportSchedule", reportScheduleSchema);
