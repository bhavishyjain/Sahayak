const AppError = require("../core/AppError");
const Department = require("../models/Department");

const DEFAULT_DEPARTMENT_NAMES = Object.freeze([
  "Road",
  "Water",
  "Electricity",
  "Waste",
  "Drainage",
  "Other",
]);

function normalizeDepartmentName(value) {
  return String(value || "").trim();
}

function slugifyDepartmentName(name) {
  return normalizeDepartmentName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureDefaultDepartments() {
  for (const name of DEFAULT_DEPARTMENT_NAMES) {
    const normalizedName = normalizeDepartmentName(name);
    const code = slugifyDepartmentName(normalizedName);
    await Department.updateOne(
      { code },
      {
        $setOnInsert: {
          name: normalizedName,
          code,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }
}

async function listDepartments({ includeInactive = false } = {}) {
  const query = includeInactive ? {} : { isActive: true };
  return Department.find(query).sort({ name: 1 }).lean();
}

async function getDepartmentByName(name, { includeInactive = true } = {}) {
  const normalizedName = normalizeDepartmentName(name);
  if (!normalizedName) return null;
  const query = { name: normalizedName };
  if (!includeInactive) query.isActive = true;
  return Department.findOne(query);
}

async function assertDepartmentExists(
  name,
  { includeInactive = false, fieldName = "department" } = {},
) {
  const department = await getDepartmentByName(name, { includeInactive: true });
  if (!department) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  if (!includeInactive && department.isActive === false) {
    throw new AppError(`${fieldName} is inactive`, 400);
  }
  return department;
}

async function getDepartmentNames({ includeInactive = false } = {}) {
  const departments = await listDepartments({ includeInactive });
  return departments.map((department) => department.name);
}

module.exports = {
  DEFAULT_DEPARTMENT_NAMES,
  normalizeDepartmentName,
  slugifyDepartmentName,
  ensureDefaultDepartments,
  listDepartments,
  getDepartmentByName,
  assertDepartmentExists,
  getDepartmentNames,
};
