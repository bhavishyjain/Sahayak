const User = require("../models/User");
const AppError = require("../core/AppError");
const { normalizeDepartment } = require("../utils/normalize");
const { ROLES } = require("../domain/constants");

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

function isComplaintOwner(complaint, userId) {
  return String(complaint?.userId || "") === String(userId || "");
}

function getComplaintAssignment(complaint, workerId) {
  const targetId = String(workerId || "");
  return (complaint?.assignedWorkers || []).find(
    (assignment) =>
      String(assignment?.workerId?._id || assignment?.workerId) === targetId,
  );
}

function isAssignedWorkerLeader(complaint, workerId) {
  const assignments = complaint?.assignedWorkers || [];
  const targetId = String(workerId || "");
  const assignedIndex = assignments.findIndex(
    (assignment) =>
      String(assignment?.workerId?._id || assignment?.workerId) === targetId,
  );

  if (assignedIndex < 0) return false;
  if (assignments.length <= 1) return true;

  const hasExplicitLeader = assignments.some(
    (assignment) => assignment?.isLeader === true,
  );
  if (!hasExplicitLeader) {
    return assignedIndex === 0;
  }

  return Boolean(assignments[assignedIndex]?.isLeader);
}

async function canViewComplaint(reqUser, complaint) {
  if (!reqUser?._id || !complaint) return false;

  const actor = await getRequestUserRoleAndDepartment(reqUser);
  if (!actor) return false;
  if (actor.role === ROLES.ADMIN) return true;
  if (actor.role === ROLES.USER) return true;
  if (actor.role === ROLES.WORKER) {
    return isWorkerAssignedToComplaint(complaint, reqUser._id);
  }
  if (actor.role === ROLES.HEAD) {
    return (
      normalizeDepartment(actor.department) ===
      normalizeDepartment(complaint.department)
    );
  }

  return false;
}

async function canAccessComplaint(reqUser, complaint) {
  if (!reqUser?._id || !complaint) return false;

  const requesterId = String(reqUser._id);
  if (isComplaintOwner(complaint, requesterId)) return true;

  const actor = await getRequestUserRoleAndDepartment(reqUser);
  if (!actor) return false;
  if (actor.role === ROLES.ADMIN) return true;

  if (actor.role === ROLES.WORKER) {
    return isWorkerAssignedToComplaint(complaint, reqUser._id);
  }

  if (actor.role === ROLES.HEAD) {
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

async function assertCanViewComplaint(reqUser, complaint) {
  const allowed = await canViewComplaint(reqUser, complaint);
  if (!allowed) {
    throw new AppError("Forbidden", 403);
  }
}

async function canParticipateInComplaintChat(reqUser, complaint) {
  return canAccessComplaint(reqUser, complaint);
}

async function assertCanParticipateInComplaintChat(reqUser, complaint) {
  const allowed = await canParticipateInComplaintChat(reqUser, complaint);
  if (!allowed) {
    throw new AppError("Forbidden", 403);
  }
}

async function canManageComplaintDepartment(reqUser, complaint) {
  if (reqUser?.role === ROLES.ADMIN) {
    return true;
  }

  const actor = await getRequestUserRoleAndDepartment(reqUser);
  if (!actor || actor.role !== ROLES.HEAD) {
    return false;
  }

  return (
    normalizeDepartment(actor.department) ===
    normalizeDepartment(complaint.department)
  );
}

async function assertCanManageComplaintByDepartment(reqUser, complaint) {
  const allowed = await canManageComplaintDepartment(reqUser, complaint);
  if (!allowed) {
    throw new AppError("Forbidden", 403);
  }
}

async function canUpdateComplaintStatusAsWorker(reqUser, complaint) {
  if (!reqUser?._id || reqUser?.role !== ROLES.WORKER) return false;
  if (!isWorkerAssignedToComplaint(complaint, reqUser._id)) return false;
  return isAssignedWorkerLeader(complaint, reqUser._id);
}

async function assertCanUpdateComplaintStatusAsWorker(reqUser, complaint) {
  if (!reqUser?._id || reqUser?.role !== ROLES.WORKER) {
    throw new AppError("Only workers can update complaint status", 403);
  }
  if (!isWorkerAssignedToComplaint(complaint, reqUser._id)) {
    throw new AppError("You are not assigned to this complaint", 403);
  }
  if (!isAssignedWorkerLeader(complaint, reqUser._id)) {
    throw new AppError(
      "Only the assigned leader can update complaint status",
      403,
    );
  }
}

async function canVoteSatisfaction(reqUser, complaint) {
  if (!reqUser?._id || !complaint) return false;
  if (reqUser.role !== ROLES.USER) return false;
  return complaint.status === "resolved";
}

async function assertCanVoteSatisfaction(reqUser, complaint) {
  if (!reqUser?._id) {
    throw new AppError("Authentication required", 401);
  }
  if (reqUser.role !== ROLES.USER) {
    throw new AppError("Only citizens can vote on satisfaction", 403);
  }
  if (complaint.status !== "resolved") {
    throw new AppError("Can only vote on resolved complaints", 400);
  }
}

module.exports = {
  normalizeDepartment,
  isWorkerAssignedToComplaint,
  isComplaintOwner,
  getComplaintAssignment,
  isAssignedWorkerLeader,
  canViewComplaint,
  canAccessComplaint,
  canParticipateInComplaintChat,
  canManageComplaintDepartment,
  canUpdateComplaintStatusAsWorker,
  canVoteSatisfaction,
  assertCanViewComplaint,
  assertCanAccessComplaint,
  assertCanParticipateInComplaintChat,
  assertCanManageComplaintByDepartment,
  assertCanUpdateComplaintStatusAsWorker,
  assertCanVoteSatisfaction,
};
