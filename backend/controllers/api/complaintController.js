const mongoose = require("mongoose");
const Complaint = require("../../models/Complaint");
const generateTicketId = require("../../utils/generateTicketId");
const cloudinary = require("../../config/cloudinary");
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
  };
}

exports.createComplaint = async (req, res) => {
  try {
    const { title, description, department, locationName, priority } = req.body;
    let { coordinates } = req.body;

    if (!title || !description || !department || !locationName) {
      return res.status(400).json({
        message:
          "title, description, department and locationName are required",
      });
    }

    if (typeof coordinates === "string") {
      try {
        coordinates = JSON.parse(coordinates);
      } catch (_error) {
        coordinates = null;
      }
    }

    let proofImage = null;
    if (req.file?.buffer) {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: "sahayak/complaints", resource_type: "image" },
          (error, result) => {
            if (error) return reject(error);
            return resolve(result);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
      });
      proofImage = uploadResult.secure_url;
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
      proofImage,
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
