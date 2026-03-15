const mongoose = require("mongoose");
const generateTicketId = require("../utils/generateTicketId");
const complaintAssignmentSchema = require("./complaintSchemas/complaintAssignmentSchema");
const complaintFeedbackSchema = require("./complaintSchemas/complaintFeedbackSchema");
const complaintSatisfactionVotesSchema = require("./complaintSchemas/complaintSatisfactionVotesSchema");
const complaintSlaSchema = require("./complaintSchemas/complaintSlaSchema");
const complaintHistorySchema = require("./complaintSchemas/complaintHistorySchema");
const complaintAiAnalysisSchema = require("./complaintSchemas/complaintAiAnalysisSchema");
const complaintMessageSchema = require("./complaintSchemas/complaintMessageSchema");

const complaintSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      default: generateTicketId,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rawText: { type: String, required: true },
    refinedText: { type: String, default: null, alias: "description" },

    department: {
      type: String,
      enum: ["Road", "Water", "Electricity", "Waste", "Drainage", "Other"],
      required: true,
    },
    // AI Analysis Fields
    aiAnalysis: { type: complaintAiAnalysisSchema, default: {} },
    coordinates: {
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
    },
    locationName: { type: String, default: null, alias: "location" },

    // Contact information for anonymous submissions
    contactInfo: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
      email: { type: String, default: null },
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    tags: [{ type: String }],
    status: {
      type: String,
      enum: [
        "pending",
        "assigned",
        "in-progress",
        "pending-approval",
        "resolved",
        "cancelled",
        "needs-rework",
      ],
      default: "pending",
    },
    // Multi-worker assignment support
    assignedWorkers: [complaintAssignmentSchema],
    assignedAt: { type: Date },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: { type: Date, default: null },
    estimatedCompletionTime: { type: Number }, // in hours
    actualCompletionTime: { type: Number }, // in hours
    completionPhotos: [{ type: String }], // URLs to after/completion photos
    proofImage: [{ type: String }], // Before photos (from citizen)
    note: { type: String },

    // Public Voting/Support
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    upvoteCount: { type: Number, default: 0 },

    // Satisfaction Voting (for resolved complaints)
    satisfactionVotes: { type: complaintSatisfactionVotesSchema, default: {} },

    // Citizen Feedback & Rating
    feedback: { type: complaintFeedbackSchema, default: {} },

    // SLA Tracking
    sla: { type: complaintSlaSchema, default: {} },

    history: [complaintHistorySchema],
    chatHistory: [{ role: String, content: String }], // stores conversation
    messages: [complaintMessageSchema], // citizen/worker/hod thread

    // Soft-delete (admin only)
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// auto-generate ticketId
complaintSchema.pre("save", function (next) {
  if (!this.ticketId) {
    this.ticketId = generateTicketId();
  }

  // Calculate SLA due date based on priority
  if (this.isNew && (!this.sla || !this.sla.dueDate)) {
    if (!this.sla) this.sla = {};
    const now = new Date();
    let hoursToAdd = 72; // Default: 3 days for Medium

    if (this.priority === "High") {
      hoursToAdd = 24; // 1 day for High
    } else if (this.priority === "Low") {
      hoursToAdd = 168; // 7 days for Low
    }

    this.sla.dueDate = new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);
  }

  // Check if overdue
  if (
    this.sla && this.sla.dueDate &&
    this.status !== "resolved" &&
    this.status !== "cancelled" &&
    this.status !== "needs-rework"
  ) {
    this.sla.isOverdue = new Date() > this.sla.dueDate;
  }

  next();
});

// Automatically exclude soft-deleted complaints from all find queries unless
// the caller explicitly opts in with .setOptions({ withDeleted: true })
complaintSchema.pre(/^find/, function (next) {
  if (!this.getOptions().withDeleted) {
    this.where({ deleted: { $ne: true } });
  }
  next();
});

// Same for aggregate pipelines
complaintSchema.pre("aggregate", function (next) {
  if (!this.options?.withDeleted) {
    this.pipeline().unshift({ $match: { deleted: { $ne: true } } });
  }
  next();
});

module.exports = mongoose.model("Complaint", complaintSchema);
