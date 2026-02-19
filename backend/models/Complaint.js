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
      enum: ["road", "water", "electricity", "waste", "drainage", "other"],
      required: true,
    },
    aiSuggestedDepartment: {
      type: String,
      enum: ["road", "water", "electricity", "waste", "drainage", "other"],
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
        "resolved",
        "closed",
        "rejected",
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
    proofImage: { type: String, default: null },
    note: { type: String },
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
  { timestamps: true }
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
  next();
});

module.exports = mongoose.model("Complaint", complaintSchema);
