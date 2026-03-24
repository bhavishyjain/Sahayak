const crypto = require("crypto");
const Complaint = require("../../models/Complaint");
const Department = require("../../models/Department");
const User = require("../../models/User");
const WorkerInvitation = require("../../models/WorkerInvitation");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { sendWorkerInvitation } = require("../../services/emailService");
const {
  assertDepartmentExists,
  listDepartments,
  normalizeDepartmentName,
  slugifyDepartmentName,
} = require("../../services/departmentService");

async function assertDepartmentComplaintsResolved(departmentName) {
  const [totalComplaints, resolvedComplaints] = await Promise.all([
    Complaint.countDocuments({ department: departmentName }),
    Complaint.countDocuments({ department: departmentName, status: "resolved" }),
  ]);

  if (totalComplaints !== resolvedComplaints) {
    throw new AppError(
      "Department can only be deleted or deactivated when all complaints are resolved",
      409,
      {
        totalComplaints,
        resolvedComplaints,
      },
    );
  }
}

exports.listDepartments = asyncHandler(async (req, res) => {
  const includeInactive =
    req.user?.role === "admin" && req.query.includeInactive === "true";
  const departments = await listDepartments({ includeInactive });
  return sendSuccess(res, { data: departments, departments });
});

exports.createDepartment = asyncHandler(async (req, res) => {
  const name = normalizeDepartmentName(req.body?.name);
  if (!name) throw new AppError("Department name is required", 400);

  const code = slugifyDepartmentName(name);
  if (!code) throw new AppError("Department name is invalid", 400);

  const existing = await Department.findOne({ $or: [{ name }, { code }] });
  if (existing) throw new AppError("Department already exists", 409);

  const department = await Department.create({ name, code, isActive: true });
  const payload = department.toObject();
  return sendSuccess(
    res,
    { data: payload, department: payload },
    "Department created successfully",
    201,
  );
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw new AppError("Department not found", 404);
  if (department.name === "Other") {
    throw new AppError("The Other department cannot be renamed", 409);
  }

  const name = normalizeDepartmentName(req.body?.name);
  if (!name) throw new AppError("Department name is required", 400);

  const code = slugifyDepartmentName(name);
  const duplicate = await Department.findOne({
    _id: { $ne: department._id },
    $or: [{ name }, { code }],
  });
  if (duplicate) throw new AppError("Department already exists", 409);

  const previousName = department.name;
  department.name = name;
  department.code = code;
  await department.save();

  await Promise.all([
    User.updateMany({ department: previousName }, { $set: { department: name } }),
    Complaint.updateMany(
      { department: previousName },
      { $set: { department: name, "aiAnalysis.department": name } },
    ),
    WorkerInvitation.updateMany(
      { department: previousName },
      { $set: { department: name } },
    ),
  ]);

  const payload = department.toObject();
  return sendSuccess(res, { data: payload, department: payload }, "Department updated successfully");
});

exports.deactivateDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw new AppError("Department not found", 404);
  if (department.name === "Other") {
    throw new AppError("The Other department cannot be deactivated", 409);
  }

  await assertDepartmentComplaintsResolved(department.name);

  department.isActive = false;
  await department.save();
  await User.updateMany(
    { department: department.name, role: { $in: ["head", "worker"] } },
    { $set: { isActive: false } },
  );

  const payload = department.toObject();
  return sendSuccess(res, { data: payload, department: payload }, "Department deactivated successfully");
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw new AppError("Department not found", 404);
  if (department.name === "Other") {
    throw new AppError("The Other department cannot be deleted", 409);
  }

  await assertDepartmentComplaintsResolved(department.name);

  const fallback = await assertDepartmentExists("Other", { includeInactive: true });
  const fallbackName = fallback.name;

  await Promise.all([
    User.updateMany({ department: department.name }, { $set: { department: fallbackName } }),
    Complaint.updateMany(
      { department: department.name },
      { $set: { department: fallbackName, "aiAnalysis.department": fallbackName } },
    ),
    WorkerInvitation.updateMany(
      { department: department.name },
      { $set: { department: fallbackName } },
    ),
  ]);

  await department.deleteOne();
  return sendSuccess(res, {}, "Department deleted successfully");
});

exports.inviteDepartmentMember = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw new AppError("Department not found", 404);
  if (department.isActive === false) {
    throw new AppError("Cannot invite members to an inactive department", 400);
  }

  const role = req.body?.role === "head" ? "head" : "worker";
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (existingUser.role === role && existingUser.department === department.name) {
      throw new AppError(
        `This user is already a ${role === "head" ? "department head" : "worker"} in this department`,
        400,
      );
    }
    throw new AppError(
      "A user account with this email already exists. Update the existing user instead of inviting again.",
      400,
    );
  }

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(inviteToken).digest("hex");
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await WorkerInvitation.updateMany(
    {
      email,
      department: department.name,
      role,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { revokedAt: new Date() } },
  );

  const invitation = await WorkerInvitation.create({
    email,
    department: department.name,
    role,
    invitedBy: req.user._id,
    tokenHash,
    expiresAt: inviteExpiry,
  });

  try {
    await sendWorkerInvitation(
      email,
      inviteToken,
      department.name,
      req.user.fullName || req.user.username,
      role,
    );
  } catch (emailError) {
    console.error("Failed to send invitation email:", emailError);
  }

  return sendSuccess(
    res,
    {
      data: {
        id: invitation._id,
        email: invitation.email,
        department: invitation.department,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    },
    `${role === "head" ? "HOD" : "Worker"} invitation sent successfully`,
    201,
  );
});

exports.listDepartmentInvitations = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw new AppError("Department not found", 404);

  const now = new Date();
  const invitations = await WorkerInvitation.find({
    department: department.name,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: now },
  })
    .sort({ createdAt: -1 })
    .select("-tokenHash");

  return sendSuccess(res, {
    data: invitations.map((invitation) => ({
      id: invitation._id,
      email: invitation.email,
      department: invitation.department,
      role: invitation.role || "worker",
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })),
  });
});

exports.revokeDepartmentInvitation = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) throw new AppError("Department not found", 404);

  const invitation = await WorkerInvitation.findOne({
    _id: req.params.invitationId,
    department: department.name,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!invitation) {
    throw new AppError("Invitation not found or already inactive", 404);
  }

  invitation.revokedAt = new Date();
  await invitation.save();

  return sendSuccess(res, { data: { id: invitation._id } }, "Invitation revoked");
});
