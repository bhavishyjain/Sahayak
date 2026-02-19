// controllers/complaintController.js
const Complaint = require("../models/Complaint");
const { analyze } = require("../services/geminiService");
const generateTicketId = require("../utils/generateTicketId");
const cloudinary = require("../config/cloudinary"); // optional if you want to upload images
const mongoose = require("mongoose");

const festivalEvents = require("../utils/festivalEvents.json");

// Helper to get user ID from request
function getUserIdFromReq(req) {
  return req.user?._id || req.session?.user?.id || req.currentUser?.id || null;
}


const processRawComplaint = async (req, res) => {
  try {
    const { rawText, lat, lng } = req.body;
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!rawText) return res.status(400).json({ message: "rawText required" });

    const ai = await analyze(rawText);
    if (!ai) return res.status(500).json({ message: "AI analysis failed" });

    // Status query
    if (ai.type === "statusQuery") {
      const targetId = ai.complaintId || "last";
      const complaint = targetId === "last"
        ? await Complaint.findOne({ userId }).sort({ createdAt: -1 })
        : await Complaint.findOne({ ticketId: targetId });

      if (!complaint) return res.status(404).json({ message: "Complaint not found" });

      return res.json({
        type: "statusQuery",
        complaintId: complaint.ticketId,
        status: complaint.status,
        department: complaint.department,
        problem: ai.refinedText,
        locationName: ai.locationName || null,
        updatedAt: complaint.updatedAt,
      });
    }

    // FAQ response
    if (ai.type === "faq") {
      return res.json({ type: "faq", answer: ai.answer || "Here's some info..." });
    }

    // New complaint
    if (ai.type === "newComplaint") {
      // Determine priority with festival logic
      let adjustedPriority = ai.priority || "Medium";
      const today = new Date();

      if (ai.locationName) {
        festivalEvents.forEach(event => {
          const start = new Date(event.startDate);
          const end = new Date(event.endDate);
          if (today >= start && today <= end && event.highPriorityLocations.includes(ai.locationName)) {
            adjustedPriority = "High"; // Festival/event location gets high priority
          }
        });
      }

      if (!lat || !lng) {
        req.session.pendingComplaint = { ...ai, userId, rawText, priority: adjustedPriority };
        return res.json({
          type: "newComplaint",
          message: "Complaint detected. Awaiting coordinates.",
          department: ai.department,
          refinedText: ai.refinedText,
          priority: adjustedPriority,
          problem: ai.refinedText,
          locationName: ai.locationName || null,
        });
      }

      const complaint = new Complaint({
        ticketId: generateTicketId(),
        userId,
        rawText,
        refinedText: ai.refinedText,
        department: ai.department,
        aiSuggestedDepartment: ai.department,
        aiConfidence: ai.aiConfidence,
        coordinates: { lat: Number(lat), lng: Number(lng) },
        locationName: ai.locationName || null,
        priority: adjustedPriority, // festival-aware priority
        status: "pending",
        history: [{ status: "pending", updatedBy: userId, note: "Created via AI" }],
      });

      await complaint.save();
      return res.status(201).json({
        type: "newComplaint",
        message: "Complaint registered successfully",
        problem: ai.refinedText,
        ticketId: complaint.ticketId,
        status: complaint.status,
        department: complaint.department,
        locationName: ai.locationName || null,
        priority: adjustedPriority,
      });
    }

    return res.status(400).json({ message: "Could not understand request" });
  } catch (err) {
    console.error("processRawComplaint error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


// 2️⃣ Confirm pending complaint
const confirmComplaint = async (req, res) => {
  try {
    const { confirmation, lat, lng } = req.body;
    const pending = req.session.pendingComplaint;
    const userId = getUserIdFromReq(req);

    if (!pending)
      return res.status(400).json({ message: "No pending complaint" });
    if (!["yes", "y"].includes(confirmation.toLowerCase())) {
      req.session.pendingComplaint = null;
      return res.json({ message: "Complaint discarded" });
    }
    if (!lat || !lng)
      return res.status(400).json({ message: "Coordinates required" });

    const complaint = new Complaint({
      ticketId: generateTicketId(),
      userId,
      rawText: pending.rawText,
      refinedText: pending.refinedText,
      department: pending.department,
      aiSuggestedDepartment: pending.department,
      aiConfidence: pending.aiConfidence,
      coordinates: { lat: Number(lat), lng: Number(lng) },
      locationName: pending.locationName || null,
      priority: pending.priority || "Medium",
      status: "pending",
      history: [
        {
          status: "pending",
          updatedBy: userId,
          note: "Created via AI confirmation",
        },
      ],
    });

    await complaint.save();
    req.session.pendingComplaint = null;

    return res.json({
      message: "Complaint registered successfully",
      ticketId: complaint.ticketId,
      status: complaint.status,
      department: complaint.department,
    });
  } catch (err) {
    console.error("confirmComplaint error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 3️⃣ Form-based complaint submission (supports anonymous submissions)
const submitComplaint = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      coordinates,
      contactName,
      contactPhone,
      contactEmail,
    } = req.body;
    const userId = getUserIdFromReq(req); // Can be null for anonymous submissions

    if (!title || !description || !category || !location)
      return res.status(400).json({ message: "Missing required fields" });

    let coords = coordinates;
    if (typeof coordinates === "string") coords = JSON.parse(coordinates);

    let uploadedImages = [];
    if (req.files?.length) {
      const uploadPromises = req.files.map((file) =>
        cloudinary.uploader.upload(file.path, {
          folder: "complaints",
          resource_type: "auto",
        })
      );
      const results = await Promise.all(uploadPromises);
      uploadedImages = results.map((r) => r.secure_url);
    }

    const ticketId = generateTicketId();
    const complaint = new Complaint({
      ticketId,
      userId: userId || null, // Allow null for anonymous submissions
      rawText: `${title}: ${description}`,
      refinedText: `Complaint: ${title}\nDescription: ${description}\nLocation: ${location}`,
      department: category,
      coordinates: coords
        ? { lat: Number(coords.lat), lng: Number(coords.lng) }
        : null,
      locationName: location,
      priority: "Medium",
      status: "pending",
      proofImage: uploadedImages[0] || null,
      // Store contact information for anonymous submissions
      contactInfo: userId
        ? null
        : {
            name: contactName,
            phone: contactPhone,
            email: contactEmail,
          },
      history: [
        {
          status: "pending",
          updatedBy: userId || "anonymous",
          note: userId
            ? "Created via web form"
            : "Anonymous submission via web form",
        },
      ],
    });

    await complaint.save();
    return res.status(201).json({
      message: "Complaint submitted successfully",
      ticketId: complaint.ticketId,
      images: uploadedImages,
    });
  } catch (err) {
    console.error("submitComplaint error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 4️⃣ Get complaint by ticket ID
const getComplaintByTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const complaint = await Complaint.findOne({ ticketId });
    if (!complaint)
      return res.status(404).json({ message: "Complaint not found" });
    return res.json(complaint);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// 5️⃣ Get last complaint of the user
const getLastComplaint = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const last = await Complaint.findOne({ userId }).sort({ createdAt: -1 });
    if (!last) return res.status(404).json({ message: "No complaints found" });
    return res.json(last);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// 6️⃣ Get all complaints (for heatmap & stats)
const getAllComplaints = async (req, res) => {
  try {
    const { department, status, priority, timeframe } = req.query;

    // Build query object
    let query = {};

    if (department && department !== "all") {
      query.department = department;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (priority && priority !== "all") {
      query.priority = priority;
    }

    // Handle timeframe
    if (timeframe && timeframe !== "all") {
      const now = new Date();
      let startDate;

      switch (timeframe) {
        case "7days":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30days":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "3months":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "6months":
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case "1year":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }

    const complaints = await Complaint.find(query)
      .select(
        "_id ticketId coordinates locationName department priority status createdAt refinedText rawText description assignedTo"
      )
      .populate("assignedTo", "fullName username")
      .sort({ createdAt: -1 })
      .limit(1000);

    console.log(`Found ${complaints.length} complaints`);

    const complaintData = complaints.map((c) => ({
      _id: c._id,
      id: c._id,
      ticketId: c.ticketId,
      lat: c.coordinates?.lat || null,
      lng: c.coordinates?.lng || null,
      coordinates: c.coordinates || null,
      location: c.locationName || c.location,
      department: c.department,
      priority: c.priority,
      status: c.status,
      createdAt: c.createdAt,
      description: c.refinedText || c.rawText || c.description,
      rawText: c.rawText,
      refinedText: c.refinedText,
      assignedTo: c.assignedTo?._id,
      assignedWorker: c.assignedTo
        ? {
            id: c.assignedTo._id,
            fullName: c.assignedTo.fullName,
            username: c.assignedTo.username,
          }
        : null,
    }));

    // Separate data for heatmap (only complaints with coordinates)
    const heatmapData = complaintData.filter(
      (c) => c.coordinates && c.coordinates.lat && c.coordinates.lng
    );

    // Calculate statistics
    const stats = {
      total: complaintData.length,
      byStatus: {},
      byDepartment: {},
      byPriority: {},
    };

    complaintData.forEach((complaint) => {
      // Status stats
      stats.byStatus[complaint.status] =
        (stats.byStatus[complaint.status] || 0) + 1;

      // Department stats
      stats.byDepartment[complaint.department] =
        (stats.byDepartment[complaint.department] || 0) + 1;

      // Priority stats
      stats.byPriority[complaint.priority] =
        (stats.byPriority[complaint.priority] || 0) + 1;
    });

    return res.json({
      total: complaintData.length,
      data: complaintData,
      heatmapData,
      stats,
    });
  } catch (err) {
    console.error("getAllComplaints error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// 7️⃣ Get user's own complaints
const getMyComplaints = async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { status, priority, timeframe } = req.query;

    // Build query object with proper ObjectId conversion
    let query = { 
      userId: new mongoose.Types.ObjectId(userId)
    };

    if (status && status !== "all") {
      query.status = status;
    }

    if (priority && priority !== "all") {
      query.priority = priority;
    }

    // Handle timeframe
    if (timeframe && timeframe !== "all") {
      const now = new Date();
      let startDate;

      switch (timeframe) {
        case "7days":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30days":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "3months":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "6months":
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case "1year":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }

      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }

    const complaints = await Complaint.find(query)
      .select(
        "_id ticketId coordinates locationName department priority status createdAt updatedAt refinedText rawText description assignedTo proofImage history userId"
      )
      .populate("assignedTo", "fullName username")
      .sort({ createdAt: -1 })
      .limit(1000);

    console.log(`Found ${complaints.length} complaints for user ${userId}`);
    console.log("Query used:", JSON.stringify(query));
    console.log("Sample complaint userId:", complaints[0]?.userId);

    const complaintData = complaints.map((c) => ({
      _id: c._id,
      id: c._id,
      ticketId: c.ticketId,
      lat: c.coordinates?.lat || null,
      lng: c.coordinates?.lng || null,
      coordinates: c.coordinates || null,
      location: c.locationName || c.location,
      department: c.department,
      priority: c.priority,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      description: c.refinedText || c.rawText || c.description,
      rawText: c.rawText,
      refinedText: c.refinedText,
      assignedTo: c.assignedTo,
      proofImage: c.proofImage,
      history: c.history,
    }));

    res.json({
      success: true,
      data: complaintData,
      total: complaintData.length,
    });
  } catch (err) {
    console.error("getMyComplaints error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// 8️⃣ Update complaint (keeping from existing file)
const updateComplaint = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove any fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.ticketId;
    delete updateData.userId;
    delete updateData.createdAt;

    // Handle coordinates properly
    if (updateData.coordinates) {
      updateData.coordinates = {
        lat: parseFloat(updateData.coordinates.lat),
        lng: parseFloat(updateData.coordinates.lng),
      };
    }

    const updatedComplaint = await Complaint.findByIdAndUpdate(
      id,
      {
        ...updateData,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!updatedComplaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    res.status(200).json({
      success: true,
      message: "Complaint updated successfully",
      data: updatedComplaint,
    });
  } catch (error) {
    console.error("updateComplaint error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating complaint",
    });
  }
};

// Export all functions
module.exports = {
  processRawComplaint,
  confirmComplaint,
  submitComplaint,
  getComplaintByTicket,
  getLastComplaint,
  getAllComplaints,
  getMyComplaints,
  updateComplaint, // Added from existing file
};
