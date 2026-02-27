const mongoose = require("mongoose");
const Complaint = require("../models/Complaint");
const generateTicketId = require("../utils/generateTicketId");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");
const { notifyUser } = require("./notificationController");

function buildComplaintView(complaint) {
  return {
    id: complaint._id,
    ticketId: complaint.ticketId,
    title: complaint.rawText?.split(":")[0] || "Complaint",
    description: complaint.refinedText || complaint.rawText,
    department: complaint.department,
    priority: complaint.priority,
    status: complaint.status,
    locationName: complaint.locationName,
    coordinates: complaint.coordinates,
    proofImage: complaint.proofImage,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    history: complaint.history || [],
    upvoteCount: complaint.upvoteCount || 0,
    upvotes: (complaint.upvotes || []).map((id) => String(id)), // Convert ObjectIds to strings
    feedback: complaint.feedback,
    sla: complaint.sla,
  };
}

exports.createComplaint = async (req, res) => {
  try {
    const { title, description, department, locationName, priority } = req.body;
    let { coordinates } = req.body;

    if (!title || !description || !department || !locationName) {
      return res.status(400).json({
        message: "title, description, department and locationName are required",
      });
    }

    if (typeof coordinates === "string") {
      try {
        coordinates = JSON.parse(coordinates);
      } catch (_error) {
        coordinates = null;
      }
    }

    // Handle multiple proof images
    let proofImages = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "sahayak/complaints", resource_type: "image" },
            (error, result) => {
              if (error) return reject(error);
              return resolve(result.secure_url);
            },
          );
          streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
      });

      proofImages = await Promise.all(uploadPromises);
    }

    const complaint = await Complaint.create({
      ticketId: generateTicketId(),
      userId: req.user._id,
      rawText: `${title}: ${description}`,
      refinedText: description,
      department,
      locationName,
      coordinates: coordinates
        ? {
            lat: Number(coordinates.lat),
            lng: Number(coordinates.lng),
          }
        : undefined,
      priority: ["Low", "Medium", "High"].includes(priority)
        ? priority
        : "Medium",
      proofImage: proofImages,
      status: "pending",
      history: [
        {
          status: "pending",
          updatedBy: req.user._id,
          note: "Created from app",
        },
      ],
    });

    await notifyUser(req.user._id, {
      title: "Complaint Received",
      body: `Ticket ${complaint.ticketId} has been created.`,
      data: { type: "complaint_created", complaintId: String(complaint._id) },
    });

    return res.status(201).json({
      message: "Complaint created",
      complaint: buildComplaintView(complaint),
    });
  } catch (error) {
    console.error("create complaint error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.myComplaints = async (req, res) => {
  try {
    const { status, limit = 20, page = 1 } = req.query;
    const safeLimit = Math.min(Number(limit) || 20, 100);
    const safePage = Math.max(Number(page) || 1, 1);

    const filter = { userId: new mongoose.Types.ObjectId(req.user._id) };
    if (status && status !== "all") {
      filter.status = status;
    }

    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      Complaint.countDocuments(filter),
    ]);

    return res.status(200).json({
      total,
      page: safePage,
      limit: safeLimit,
      complaints: complaints.map(buildComplaintView),
    });
  } catch (error) {
    console.error("my complaints error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getComplaintById = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const complaint = await Complaint.findById(complaintId);

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    const isOwner = String(complaint.userId) === String(req.user._id);
    const elevatedRoles = ["admin", "head", "worker"];

    if (!isOwner && !elevatedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json({ complaint: buildComplaintView(complaint) });
  } catch (error) {
    console.error("get complaint error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Upvote a complaint
exports.upvoteComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const userId = req.user._id;

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Check if user already upvoted
    const hasUpvoted = complaint.upvotes.some(
      (id) => String(id) === String(userId),
    );

    if (hasUpvoted) {
      // Remove upvote
      complaint.upvotes = complaint.upvotes.filter(
        (id) => String(id) !== String(userId),
      );
      complaint.upvoteCount = Math.max(0, complaint.upvoteCount - 1);
    } else {
      // Add upvote
      complaint.upvotes.push(userId);
      complaint.upvoteCount += 1;

      // Auto-escalate if upvotes reach threshold
      if (complaint.upvoteCount >= 100 && complaint.priority === "Low") {
        complaint.priority = "Medium";
      } else if (
        complaint.upvoteCount >= 200 &&
        complaint.priority === "Medium"
      ) {
        complaint.priority = "High";
      }
    }

    await complaint.save();

    return res.status(200).json({
      message: hasUpvoted ? "Upvote removed" : "Upvoted successfully",
      upvoteCount: complaint.upvoteCount,
      hasUpvoted: !hasUpvoted,
    });
  } catch (error) {
    console.error("upvote complaint error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// Submit feedback for a resolved complaint
exports.submitFeedback = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    if (!rating || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "Rating must be between 1 and 5" });
    }

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found" });
    }

    // Only allow feedback on resolved/closed complaints
    if (complaint.status !== "resolved" && complaint.status !== "closed") {
      return res.status(400).json({
        message: "Feedback can only be submitted for resolved complaints",
      });
    }

    // Check if user is the complaint owner
    if (String(complaint.userId) !== String(userId)) {
      return res.status(403).json({
        message: "Only complaint owner can submit feedback",
      });
    }

    // Check if feedback already exists
    if (complaint.feedback && complaint.feedback.rating) {
      return res.status(400).json({
        message: "Feedback already submitted for this complaint",
      });
    }

    complaint.feedback = {
      rating,
      comment: comment || "",
      ratedBy: userId,
      ratedAt: new Date(),
    };

    await complaint.save();

    return res.status(200).json({
      message: "Feedback submitted successfully",
      feedback: complaint.feedback,
    });
  } catch (error) {
    console.error("submit feedback error", error);
    return res.status(500).json({ message: "Server error" });
  }
};
