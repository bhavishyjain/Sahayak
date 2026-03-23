const Complaint = require("../../models/Complaint");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");

exports.listDeletedComplaints = asyncHandler(async (req, res) => {
  const { department, page = 1, limit = 20 } = req.query;

  const filter = { deleted: true };
  if (department && department !== "all") filter.department = department;

  const skip = (Number(page) - 1) * Number(limit);
  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .setOptions({ withDeleted: true })
      .sort({ deletedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select("ticketId rawText department status deletedAt userId createdAt history")
      .populate("userId", "fullName username email"),
    Complaint.countDocuments(filter).setOptions({ withDeleted: true }),
  ]);

  const serializedComplaints = complaints.map((complaint) => {
    const history = Array.isArray(complaint.history) ? complaint.history : [];
    const latestEntry = history[history.length - 1] || null;

    return {
      ...complaint.toObject(),
      owner: complaint.userId
        ? {
            id: complaint.userId._id,
            fullName: complaint.userId.fullName,
            username: complaint.userId.username,
            email: complaint.userId.email,
          }
        : null,
      originalStatus: complaint.status,
      deletedReason: latestEntry?.note || "Soft-deleted by admin",
    };
  });

  sendSuccess(res, {
    complaints: serializedComplaints,
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

exports.softDeleteComplaint = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) throw new AppError("Complaint not found", 404);
  if (complaint.deleted) throw new AppError("Complaint is already deleted", 409);
  if (complaint.status !== "pending") {
    throw new AppError("Only pending complaints can be deleted", 409);
  }
  if (Array.isArray(complaint.assignedWorkers) && complaint.assignedWorkers.length > 0) {
    throw new AppError("Assigned complaints cannot be deleted", 409);
  }

  complaint.deleted = true;
  complaint.deletedAt = new Date();
  complaint.history.push({
    status: complaint.status,
    updatedBy: req.user.userId,
    timestamp: new Date(),
    note: "Soft-deleted by admin",
  });
  await complaint.save();

  sendSuccess(res, { message: "Complaint soft-deleted successfully" });
});

exports.restoreComplaint = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const complaint = await Complaint.findById(complaintId).setOptions({ withDeleted: true });
  if (!complaint) throw new AppError("Complaint not found", 404);
  if (!complaint.deleted) throw new AppError("Complaint is not deleted", 409);

  complaint.deleted = false;
  complaint.deletedAt = null;
  complaint.history.push({
    status: complaint.status,
    updatedBy: req.user.userId,
    timestamp: new Date(),
    note: "Restored by admin",
  });
  await complaint.save();

  sendSuccess(res, { message: "Complaint restored successfully" });
});

exports.hardDeleteComplaint = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const complaint = await Complaint.findById(complaintId).setOptions({ withDeleted: true });
  if (!complaint) throw new AppError("Complaint not found", 404);
  if (!complaint.deleted) {
    throw new AppError("Complaint must be soft-deleted before permanent deletion", 409);
  }

  await complaint.deleteOne();

  sendSuccess(res, { message: "Complaint permanently deleted" });
});
