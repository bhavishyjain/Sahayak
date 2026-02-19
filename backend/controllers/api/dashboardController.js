const Complaint = require("../../models/Complaint");

exports.summary = async (req, res) => {
  try {
    const userId = req.user._id;

    const [total, pending, inProgress, resolved, recentComplaints] =
      await Promise.all([
        Complaint.countDocuments({ userId }),
        Complaint.countDocuments({ userId, status: "pending" }),
        Complaint.countDocuments({ userId, status: "in-progress" }),
        Complaint.countDocuments({ userId, status: "resolved" }),
        Complaint.find({ userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select(
            "ticketId rawText refinedText department priority status locationName createdAt"
          ),
      ]);

    return res.status(200).json({
      stats: {
        total,
        pending,
        inProgress,
        resolved,
      },
      recent: recentComplaints.map((item) => ({
        id: item._id,
        ticketId: item.ticketId,
        title: item.rawText?.split(":")[0] || "Complaint",
        description: item.refinedText || item.rawText,
        department: item.department,
        priority: item.priority,
        status: item.status,
        locationName: item.locationName,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("dashboard summary error", error);
    return res.status(500).json({ message: "Server error" });
  }
};
