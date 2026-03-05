const crypto = require("crypto");
const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const WorkerInvitation = require("../../models/WorkerInvitation");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { getHodOrThrow, getWorkerOrThrow } = require("../../services/accessService");
const { sendWorkerInvitation } = require("../../services/emailService");

exports.inviteWorker = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const { email } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    throw new AppError("Email is required", 400);
  }

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (existingUser.role === "worker") {
      if (existingUser.department === hod.department) {
        throw new AppError("This user is already a worker in your department", 400);
      }
      throw new AppError("This user is already a worker in another department", 400);
    }
    throw new AppError(
      "A user account with this email already exists. Promote the existing user instead of inviting again.",
      400,
    );
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(inviteToken)
    .digest("hex");
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await WorkerInvitation.updateMany(
    {
      email: normalizedEmail,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { revokedAt: new Date() } },
  );

  const invitation = await WorkerInvitation.create({
    email: normalizedEmail,
    department: hod.department,
    invitedBy: hod._id,
    tokenHash,
    expiresAt: inviteExpiry,
  });

  try {
    await sendWorkerInvitation(
      normalizedEmail,
      inviteToken,
      hod.department,
      hod.fullName || hod.username,
    );
  } catch (emailError) {
    console.error("Failed to send invitation email:", emailError);
  }

  return sendSuccess(
    res,
    {
      invitation: {
        id: invitation._id,
        email: invitation.email,
        department: invitation.department,
        invitedBy: invitation.invitedBy,
        expiresAt: invitation.expiresAt,
      },
      message: `Invitation sent to ${email}`,
    },
    "Worker invitation sent successfully",
  );
});

exports.removeWorker = asyncHandler(async (req, res) => {
  const hod = await getHodOrThrow(req);
  const { workerId } = req.params;

  const worker = await getWorkerOrThrow(workerId, {
    department: hod.department,
    departmentErrorMessage: "Worker not found in your department",
  });

  const activeComplaints = await Complaint.countDocuments({
    "assignedWorkers.workerId": worker._id,
    status: { $in: ["assigned", "in-progress", "needs-rework"] },
  });

  if (activeComplaints > 0) {
    throw new AppError(
      `Cannot remove worker. They have ${activeComplaints} active complaint(s). Please reassign them first.`,
      400,
    );
  }

  worker.role = "user";
  worker.department = "Other";
  await worker.save();

  return sendSuccess(
    res,
    { user: { id: worker._id, username: worker.username, role: worker.role } },
    `${worker.fullName} has been removed from the worker role`,
  );
});
