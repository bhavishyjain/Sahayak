const Complaint = require("../models/Complaint");
const User = require("../models/User");

// 1. Get all complaints of a department
exports.getComplaintsByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const complaints = await Complaint.find({ department })
      .populate("userId", "username")
      .populate("assignedTo", "username")
      .sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// 2. Assign complaint to a worker
exports.assignWorker = async (req, res) => {
  try {
    const { complaintId, workerId } = req.body;
    const complaint = await Complaint.findById(complaintId);
    if (!complaint)
      return res.status(404).json({ message: "Complaint not found" });

    complaint.assignedTo = workerId;
    complaint.status = "in-progress";
    complaint.history.push({
      status: "in-progress",
      updatedBy: req.currentUser._id,
      note: `Assigned to worker ${workerId}`,
    });

    await complaint.save();
    res.json({ message: "Complaint assigned successfully", complaint });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// 3. Update status of a complaint (optional note)
exports.updateComplaintStatus = async (req, res) => {
  try {
    const { complaintId, status, note } = req.body;
    const complaint = await Complaint.findById(complaintId);
    if (!complaint)
      return res.status(404).json({ message: "Complaint not found" });

    complaint.status = status;
    complaint.history.push({
      status,
      updatedBy: req.currentUser?._id || null,
      note: note || null,
    });

    await complaint.save();
    res.json({ message: "Complaint status updated", complaint });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};
