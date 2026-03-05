const User = require("../models/User");
const AppError = require("../core/AppError");

function normalizeDepartment(value) {
  return String(value || "").trim().toLowerCase();
}

function isWorkerAssignedToComplaint(complaint, workerId) {
  const targetId = String(workerId || "");
  return (complaint?.assignedWorkers || []).some(
    (assignment) =>
      String(assignment?.workerId?._id || assignment?.workerId) === targetId,
  );
}

async function getRequestUserRoleAndDepartment(reqUser) {
  if (!reqUser?._id) return null;
  if (reqUser.role === "admin") {
    return { role: "admin", department: null };
  }

  if (reqUser.department) {
    return { role: reqUser.role, department: reqUser.department };
  }

  const user = await User.findById(reqUser._id).select("role department");
  if (!user) return null;
  return { role: user.role, department: user.department };
}

async function canAccessComplaint(reqUser, complaint) {
  if (!reqUser?._id || !complaint) return false;

  const requesterId = String(reqUser._id);
  if (String(complaint.userId || "") === requesterId) return true;

  const actor = await getRequestUserRoleAndDepartment(reqUser);
  if (!actor) return false;
  if (actor.role === "admin") return true;

  if (actor.role === "worker") {
    return isWorkerAssignedToComplaint(complaint, reqUser._id);
  }

  if (actor.role === "head") {
    return (
      normalizeDepartment(actor.department) ===
      normalizeDepartment(complaint.department)
    );
  }

  return false;
}

async function assertCanAccessComplaint(reqUser, complaint) {
  const allowed = await canAccessComplaint(reqUser, complaint);
  if (!allowed) {
    throw new AppError("Forbidden", 403);
  }
}

async function assertCanManageComplaintByDepartment(reqUser, complaint) {
  if (reqUser?.role === "admin") {
    return;
  }
  const actor = await getRequestUserRoleAndDepartment(reqUser);
  if (!actor || actor.role !== "head") {
    throw new AppError("Forbidden", 403);
  }
  if (
    normalizeDepartment(actor.department) !==
    normalizeDepartment(complaint.department)
  ) {
    throw new AppError("Forbidden", 403);
  }
}

module.exports = {
  normalizeDepartment,
  isWorkerAssignedToComplaint,
  canAccessComplaint,
  assertCanAccessComplaint,
  assertCanManageComplaintByDepartment,
};
