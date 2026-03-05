const bcrypt = require("bcryptjs");
const User = require("../models/User");
const AppError = require("../core/AppError");

async function assertIdentityAvailable({ username, email, phone }, excludeUserId = null) {
  const normalizedUsername = username ? String(username).trim().toLowerCase() : "";
  const normalizedEmail = email ? String(email).trim().toLowerCase() : "";
  const normalizedPhone = phone ? String(phone).trim() : "";
  const clauses = [];
  if (normalizedUsername) clauses.push({ username: normalizedUsername });
  if (normalizedEmail) clauses.push({ email: normalizedEmail });
  if (normalizedPhone) clauses.push({ phone: normalizedPhone });
  if (clauses.length === 0) return;

  const query = { $or: clauses };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }
  const existing = await User.findOne(query);
  if (!existing) return;

  if (normalizedUsername && existing.username === normalizedUsername) {
    throw new AppError("Username already exists", 409);
  }
  if (normalizedEmail && existing.email === normalizedEmail) {
    throw new AppError("Email is already in use", 409);
  }
  if (normalizedPhone && existing.phone === normalizedPhone) {
    throw new AppError("Phone is already in use", 409);
  }
  throw new AppError("User already exists with provided details", 409);
}

async function createUserAccount({
  username,
  password,
  fullName,
  email,
  phone,
  role = "user",
  department = "Other",
  specializations = [],
}) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPhone = String(phone || "").trim();
  await assertIdentityAvailable({
    username: normalizedUsername,
    email: normalizedEmail,
    phone: normalizedPhone,
  });

  const hashedPassword = await bcrypt.hash(password, 10);
  return User.create({
    username: normalizedUsername,
    password: hashedPassword,
    fullName,
    email: normalizedEmail,
    phone: normalizedPhone,
    role,
    department,
    specializations,
  });
}

module.exports = {
  assertIdentityAvailable,
  createUserAccount,
};
