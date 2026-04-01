const Complaint = require("../../models/Complaint");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { assertDepartmentExists } = require("../../services/departmentService");
const User = require("../../models/User");
const {
  emitComplaintUpdated,
  emitRealtimeEvent,
} = require("../../services/realtimeService");
const {
  deliverNotificationBatch,
} = require("../../services/notificationDeliveryService");
const {
  buildNotificationRoute,
  NOTIFICATION_ROUTE_SCREENS,
} = require("../../services/notificationDomainService");
const { NOTIFICATION_TYPES, ROLES } = require("../../domain/constants");

async function emitAdminDashboardEvent(event, complaintId = null) {
  const admins = await User.find({ role: "admin", isActive: true }).select("_id");
  emitRealtimeEvent(
    "admin-updated",
    {
      event,
      complaintId: complaintId ? String(complaintId) : null,
      updatedAt: new Date().toISOString(),
    },
    { userIds: admins.map((admin) => admin._id) },
  );
}

async function notifyOtherAdminsAboutRecycleBinAction({
  actorId,
  complaint,
  action,
  title,
  body,
}) {
  const otherAdmins = await User.find({
    role: ROLES.ADMIN,
    isActive: true,
    _id: { $ne: actorId },
  }).select("_id");

  const recipientIds = otherAdmins.map((admin) => admin._id);
  if (recipientIds.length === 0 || !complaint?._id) return;

  await deliverNotificationBatch(
    recipientIds,
    {
      title,
      body,
      data: {
        type: NOTIFICATION_TYPES.DELETED_COMPLAINT,
        complaintId: String(complaint._id),
        ticketId: complaint.ticketId,
        action,
        route: buildNotificationRoute(NOTIFICATION_ROUTE_SCREENS.RECYCLE_BIN, {
          complaintId: String(complaint._id),
          ticketId: complaint.ticketId,
        }),
      },
    },
    { saveHistory: true },
  );
}

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
  await notifyOtherAdminsAboutRecycleBinAction({
    actorId: req.user.userId,
    complaint,
    action: "soft-delete",
    title: "Complaint Moved To Recycle Bin",
    body: `Complaint #${complaint.ticketId} was soft-deleted and moved to the recycle bin.`,
  });
  await emitAdminDashboardEvent("complaint-soft-deleted", complaint._id);

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
  await notifyOtherAdminsAboutRecycleBinAction({
    actorId: req.user.userId,
    complaint,
    action: "restore",
    title: "Complaint Restored",
    body: `Complaint #${complaint.ticketId} was restored from the recycle bin.`,
  });
  await emitAdminDashboardEvent("complaint-restored", complaint._id);

  sendSuccess(res, { message: "Complaint restored successfully" });
});

exports.hardDeleteComplaint = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const complaint = await Complaint.findById(complaintId).setOptions({ withDeleted: true });
  if (!complaint) throw new AppError("Complaint not found", 404);
  if (!complaint.deleted) {
    throw new AppError("Complaint must be soft-deleted before permanent deletion", 409);
  }

  await notifyOtherAdminsAboutRecycleBinAction({
    actorId: req.user.userId,
    complaint,
    action: "purge",
    title: "Complaint Permanently Deleted",
    body: `Complaint #${complaint.ticketId} was permanently deleted from the recycle bin.`,
  });

  await complaint.deleteOne();
  await emitAdminDashboardEvent("complaint-purged", complaintId);

  sendSuccess(res, { message: "Complaint permanently deleted" });
});

exports.updateComplaintByAdmin = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { priority, department } = req.body;

  const complaint = await Complaint.findById(complaintId);
  if (!complaint) throw new AppError("Complaint not found", 404);
  if (complaint.deleted) {
    throw new AppError("Deleted complaints cannot be edited", 409);
  }

  const updates = {};
  const changeNotes = [];

  if (department !== undefined) {
    const nextDepartment = String(department || "").trim();
    if (!nextDepartment) {
      throw new AppError("Department is required", 400);
    }
    await assertDepartmentExists(nextDepartment);
    if (complaint.department !== nextDepartment) {
      changeNotes.push(
        `changed department from ${complaint.department || "-"} to ${nextDepartment}`,
      );
    }
    updates.department = nextDepartment;
    if (complaint.aiAnalysis && typeof complaint.aiAnalysis === "object") {
      complaint.aiAnalysis.department = nextDepartment;
    }
  }

  if (priority !== undefined) {
    const nextPriority = String(priority || "").trim();
    if (!["Low", "Medium", "High"].includes(nextPriority)) {
      throw new AppError("Invalid priority", 400);
    }
    if (complaint.priority !== nextPriority) {
      changeNotes.push(
        `changed priority from ${complaint.priority || "-"} to ${nextPriority}`,
      );
    }
    updates.priority = nextPriority;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("No valid fields provided for update", 400);
  }

  if (changeNotes.length === 0) {
    throw new AppError("No complaint changes were made", 400);
  }

  Object.assign(complaint, updates);
  complaint.history.push({
    status: complaint.status,
    updatedBy: req.user?._id || req.user?.userId,
    timestamp: new Date(),
    note: `Complaint edited by admin - ${changeNotes.join(" and ")}`,
  });
  await complaint.save();
  await emitComplaintUpdated({
    complaint,
    actorId: req.user?._id || req.user?.userId || null,
    event: "complaint-updated-by-admin",
    extra: {
      departmentChanged: department !== undefined,
      priorityChanged: priority !== undefined,
    },
  });

  sendSuccess(res, { data: complaint }, "Complaint updated successfully");
});
