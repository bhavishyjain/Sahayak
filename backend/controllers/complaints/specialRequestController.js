const Complaint = require("../../models/Complaint");
const ComplaintSpecialRequest = require("../../models/ComplaintSpecialRequest");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { assertDepartmentExists } = require("../../services/departmentService");
const {
  getComplaintOrThrow,
  getHodOrThrow,
  getRequestUserId,
} = require("../../services/accessService");
const { emitComplaintUpdated } = require("../../services/realtimeService");

function buildUpdateChangeNotes({
  currentDepartment,
  requestedDepartment,
  currentPriority,
  requestedPriority,
}) {
  const changeNotes = [];

  if (
    requestedDepartment &&
    String(requestedDepartment).trim() !== String(currentDepartment).trim()
  ) {
    changeNotes.push(
      `change department from ${currentDepartment || "-"} to ${requestedDepartment}`,
    );
  }

  if (
    requestedPriority &&
    String(requestedPriority).trim() !== String(currentPriority).trim()
  ) {
    changeNotes.push(
      `change priority from ${currentPriority || "-"} to ${requestedPriority}`,
    );
  }

  return changeNotes;
}

function serializeSpecialRequest(request) {
  const requestedBy = request?.requestedBy;
  const reviewedBy = request?.reviewedBy;

  return {
    id: request._id,
    complaintId: request.complaintId?._id || request.complaintId,
    ticketId: request.ticketId,
    department: request.department,
    requestType: request.requestType,
    currentDepartment: request.currentDepartment,
    requestedDepartment: request.requestedDepartment,
    currentPriority: request.currentPriority,
    requestedPriority: request.requestedPriority,
    reason: request.reason,
    status: request.status,
    reviewNote: request.reviewNote,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    requestedBy: requestedBy
      ? {
          id: requestedBy._id,
          fullName: requestedBy.fullName,
          username: requestedBy.username,
          email: requestedBy.email,
        }
      : null,
    reviewedBy: reviewedBy
      ? {
          id: reviewedBy._id,
          fullName: reviewedBy.fullName,
          username: reviewedBy.username,
          email: reviewedBy.email,
        }
      : null,
  };
}

exports.createSpecialRequest = asyncHandler(async (req, res) => {
  const { complaintId } = req.params;
  const { requestType = "update", requestedDepartment, requestedPriority, reason } = req.body;
  const hod = await getHodOrThrow(req);
  const hodId = getRequestUserId(req);
  const complaint = await getComplaintOrThrow(complaintId, {
    department: hod.department,
  });

  const normalizedType = requestType === "delete" ? "delete" : "update";
  const normalizedReason = String(reason || "").trim() || null;
  const nextDepartment =
    requestedDepartment !== undefined && requestedDepartment !== null
      ? String(requestedDepartment).trim()
      : null;
  const nextPriority =
    requestedPriority !== undefined && requestedPriority !== null
      ? String(requestedPriority).trim()
      : null;

  const existingPendingRequest = await ComplaintSpecialRequest.findOne({
    complaintId: complaint._id,
    status: "pending",
  });
  if (existingPendingRequest) {
    throw new AppError("A pending special request already exists for this complaint", 409);
  }

  if (normalizedType === "update") {
    if (nextDepartment) {
      await assertDepartmentExists(nextDepartment);
    }
    if (nextPriority && !["Low", "Medium", "High"].includes(nextPriority)) {
      throw new AppError("Invalid priority", 400);
    }

    const changeNotes = buildUpdateChangeNotes({
      currentDepartment: complaint.department,
      requestedDepartment: nextDepartment || complaint.department,
      currentPriority: complaint.priority,
      requestedPriority: nextPriority || complaint.priority,
    });

    if (changeNotes.length === 0) {
      throw new AppError("No changes requested", 400);
    }
  }

  const request = await ComplaintSpecialRequest.create({
    complaintId: complaint._id,
    ticketId: complaint.ticketId,
    department: complaint.department,
    requestType: normalizedType,
    currentDepartment: complaint.department,
    requestedDepartment: normalizedType === "update" ? nextDepartment || complaint.department : null,
    currentPriority: complaint.priority,
    requestedPriority: normalizedType === "update" ? nextPriority || complaint.priority : null,
    reason: normalizedReason,
    requestedBy: hodId,
  });

  const requestNote =
    normalizedType === "delete"
      ? `Special delete request submitted by HOD${normalizedReason ? ` - ${normalizedReason}` : ""}`
      : `Special request submitted by HOD - ${buildUpdateChangeNotes({
          currentDepartment: complaint.department,
          requestedDepartment: request.requestedDepartment,
          currentPriority: complaint.priority,
          requestedPriority: request.requestedPriority,
        }).join(" and ")}${normalizedReason ? ` - ${normalizedReason}` : ""}`;

  complaint.history.push({
    status: complaint.status,
    updatedBy: hodId,
    timestamp: new Date(),
    note: requestNote,
  });
  await complaint.save();

  const savedRequest = await ComplaintSpecialRequest.findById(request._id).populate(
    "requestedBy",
    "fullName username email",
  );

  return sendSuccess(
    res,
    { data: serializeSpecialRequest(savedRequest) },
    "Special request submitted successfully",
    201,
  );
});

exports.listHodSpecialRequests = asyncHandler(async (req, res) => {
  const hodId = getRequestUserId(req);
  const requests = await ComplaintSpecialRequest.find({ requestedBy: hodId })
    .sort({ createdAt: -1 })
    .populate("requestedBy", "fullName username email")
    .populate("reviewedBy", "fullName username email");

  return sendSuccess(res, {
    data: requests.map(serializeSpecialRequest),
  });
});

exports.listAdminSpecialRequests = asyncHandler(async (req, res) => {
  const status = String(req.query.status || "pending").trim();
  const filter = {};
  if (status && status !== "all") {
    filter.status = status;
  }

  const requests = await ComplaintSpecialRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate("requestedBy", "fullName username email")
    .populate("reviewedBy", "fullName username email");

  return sendSuccess(res, {
    data: requests.map(serializeSpecialRequest),
  });
});

exports.reviewSpecialRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { decision, reviewNote } = req.body;
  const normalizedDecision = decision === "reject" ? "reject" : "approve";
  const adminId = getRequestUserId(req);

  const request = await ComplaintSpecialRequest.findById(requestId);
  if (!request) throw new AppError("Special request not found", 404);
  if (request.status !== "pending") {
    throw new AppError("Special request has already been reviewed", 409);
  }

  const complaint = await Complaint.findById(request.complaintId);
  if (!complaint) throw new AppError("Complaint not found", 404);

  if (normalizedDecision === "approve") {
    if (request.requestType === "delete") {
      if (complaint.status !== "pending") {
        throw new AppError("Only pending complaints can be deleted", 409);
      }
      if (
        Array.isArray(complaint.assignedWorkers) &&
        complaint.assignedWorkers.length > 0
      ) {
        throw new AppError("Assigned complaints cannot be deleted", 409);
      }

      complaint.deleted = true;
      complaint.deletedAt = new Date();
      complaint.history.push({
        status: complaint.status,
        updatedBy: adminId,
        timestamp: new Date(),
        note: `Special delete request approved by admin${reviewNote ? ` - ${String(reviewNote).trim()}` : ""}`,
      });
    } else {
      const changeNotes = buildUpdateChangeNotes({
        currentDepartment: complaint.department,
        requestedDepartment: request.requestedDepartment,
        currentPriority: complaint.priority,
        requestedPriority: request.requestedPriority,
      });

      if (request.requestedDepartment) {
        complaint.department = request.requestedDepartment;
        if (complaint.aiAnalysis && typeof complaint.aiAnalysis === "object") {
          complaint.aiAnalysis.department = request.requestedDepartment;
        }
      }
      if (request.requestedPriority) {
        complaint.priority = request.requestedPriority;
      }

      complaint.history.push({
        status: complaint.status,
        updatedBy: adminId,
        timestamp: new Date(),
        note: `Special request approved by admin - ${changeNotes.join(" and ")}${reviewNote ? ` - ${String(reviewNote).trim()}` : ""}`,
      });
    }

    request.status = "approved";
  } else {
    complaint.history.push({
      status: complaint.status,
      updatedBy: adminId,
      timestamp: new Date(),
      note: `Special request rejected by admin${reviewNote ? ` - ${String(reviewNote).trim()}` : ""}`,
    });
    request.status = "rejected";
  }

  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  request.reviewNote = String(reviewNote || "").trim() || null;

  await complaint.save();
  await request.save();

  if (normalizedDecision === "approve") {
    await emitComplaintUpdated({
      complaint,
      actorId: adminId,
      event:
        request.requestType === "delete"
          ? "complaint-deleted"
          : "complaint-updated-by-admin",
      extra: {
        departmentChanged:
          request.requestType === "update" &&
          String(request.currentDepartment || "").trim() !==
            String(request.requestedDepartment || "").trim(),
        priorityChanged:
          request.requestType === "update" &&
          String(request.currentPriority || "").trim() !==
            String(request.requestedPriority || "").trim(),
      },
    });
  }

  const savedRequest = await ComplaintSpecialRequest.findById(request._id)
    .populate("requestedBy", "fullName username email")
    .populate("reviewedBy", "fullName username email");

  return sendSuccess(
    res,
    { data: serializeSpecialRequest(savedRequest) },
    `Special request ${request.status}`,
  );
});
