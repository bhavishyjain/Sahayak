const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Made optional to support anonymous submissions
      default: null,
    },
    rawText: { type: String, required: true },
    refinedText: { type: String, default: null },

    // additional description field for form submissions (keeping from existing)
    description: { type: String, default: null },

    department: {
      type: String,
      enum: ["Road", "Water", "Electricity", "Waste", "Drainage", "Other"],
      required: true,
    },
    aiSuggestedDepartment: {
      type: String,
      enum: ["Road", "Water", "Electricity", "Waste", "Drainage", "Other"],
      default: null,
    },
    aiConfidence: { type: Number, min: 0, max: 1, default: null },
    coordinates: {
      lat: { type: Number, required: false },
      lng: { type: Number, required: false },
    },
    locationName: { type: String, default: null },

    // Contact information for anonymous submissions
    contactInfo: {
      name: { type: String, default: null },
      phone: { type: String, default: null },
      email: { type: String, default: null },
    },

    // additional location field (keeping from existing)
    location: { type: String, default: null },

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
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: { type: Date },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    estimatedCompletionTime: { type: Number }, // in hours
    actualCompletionTime: { type: Number }, // in hours
    workerNotes: { type: String },
    completionPhotos: [{ type: String }], // URLs to completion photos
    proofImage: [{ type: String }], // Changed to array for multiple photos
    note: { type: String },

    // Public Voting/Support
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    upvoteCount: { type: Number, default: 0 },

    // Citizen Feedback & Rating
    feedback: {
      rating: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: null },
      ratedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      ratedAt: { type: Date, default: null },
    },

    // SLA Tracking
    sla: {
      dueDate: { type: Date, default: null },
      isOverdue: { type: Boolean, default: false },
      escalated: { type: Boolean, default: false },
      escalationLevel: { type: Number, default: 0 },
      escalationHistory: [
        {
          level: Number,
          escalatedAt: Date,
          escalatedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
        },
      ],
    },

    history: [
      {
        status: String,
        updatedBy: {
          type: mongoose.Schema.Types.Mixed, // Allow ObjectId or String for anonymous users
          ref: "User",
          default: null,
        },
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
    chatHistory: [{ role: String, content: String }], // stores conversation
  },
  { timestamps: true },
);

// auto-generate ticketId
complaintSchema.pre("save", function (next) {
  if (!this.ticketId) {
    const base = Date.now().toString(36).toUpperCase();
    this.ticketId = `CMP-${base}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;
  }

  // Calculate SLA due date based on priority
  if (this.isNew && !this.sla.dueDate) {
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
    this.sla.dueDate &&
    this.status !== "resolved" &&
    this.status !== "cancelled" &&
    this.status !== "needs-rework"
  ) {
    this.sla.isOverdue = new Date() > this.sla.dueDate;
  }

  next();
});

module.exports = mongoose.model("Complaint", complaintSchema);
