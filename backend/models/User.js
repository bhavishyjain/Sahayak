const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["user", "head", "worker", "admin"],
    default: "user",
  },
  department: {
    type: String,
    enum: ["Road", "Water", "Electricity", "Waste", "Drainage", "Other"],
    default: "Other",
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: { type: String, required: true, unique: true, trim: true },
  fullName: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  lastActive: { type: Date, default: Date.now },

  // Worker-specific fields
  assignedComplaints: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
    },
  ],
  completedComplaints: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Complaint",
    },
  ],
  workLocation: {
    lat: { type: Number },
    lng: { type: Number },
    address: { type: String },
  },
  specializations: [{ type: String }],
  rating: { type: Number, default: 4.5, min: 0, max: 5 },
  performanceMetrics: {
    totalCompleted: { type: Number, default: 0 },
    averageCompletionTime: { type: Number, default: 0 }, // in hours
    currentWeekCompleted: { type: Number, default: 0 },
    customerRating: { type: Number, default: 4.5 },
  },
  pushTokens: [{ type: String }],
  preferredLanguage: {
    type: String,
    enum: ["en", "hi", "mr", "gu", "ta", "te", "bn", "kn", "ml", "pa", "ur"],
    default: "en",
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update the updatedAt field before saving
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("User", userSchema);
