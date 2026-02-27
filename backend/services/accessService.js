const Complaint = require("../models/Complaint");
const User = require("../models/User");
const AppError = require("../core/AppError");

function normalizeDepartment(value) {
  return String(value || "").trim().toLowerCase();
}

function getRequestUserId(req) {
  return req.user?.id || req.user?._id;
}

async function getHodOrThrow(req) {
  const hodId = getRequestUserId(req);
  const hod = await User.findById(hodId);
  if (!hod || hod.role !== "head") {
    throw new AppError("Access denied. HOD only.", 403);
  }
  return hod;
}

async function getWorkerOrThrow(workerId, options = {}) {
  const worker = await User.findById(workerId);
  if (!worker || worker.role !== "worker") {
    throw new AppError("Worker not found", 404);
  }

  if (
    options.department &&
    normalizeDepartment(worker.department) !==
      normalizeDepartment(options.department)
  ) {
    throw new AppError(options.departmentErrorMessage || "Worker is not in your department", 400);
  }

  return worker;
}

async function getComplaintOrThrow(complaintId, options = {}) {
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) {
    throw new AppError("Complaint not found", 404);
  }

  if (
    options.department &&
    normalizeDepartment(complaint.department) !==
      normalizeDepartment(options.department)
  ) {
    throw new AppError(
      options.departmentErrorMessage || "This complaint is not in your department",
      options.departmentStatusCode || 403,
    );
  }

  return complaint;
}

module.exports = {
  getRequestUserId,
  getHodOrThrow,
  getWorkerOrThrow,
  getComplaintOrThrow,
};
