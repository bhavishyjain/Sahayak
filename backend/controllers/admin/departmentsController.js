const Complaint = require("../../models/Complaint");
const Department = require("../../models/Department");
const User = require("../../models/User");
const WorkerInvitation = require("../../models/WorkerInvitation");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const {
  assertDepartmentExists,
  listDepartments,
  normalizeDepartmentName,
  slugifyDepartmentName,
} = require("../../services/departmentService");

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
