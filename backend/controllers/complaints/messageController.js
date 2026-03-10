const Complaint = require("../../models/Complaint");
const User = require("../../models/User");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { assertCanAccessComplaint } = require("../../policies/complaintPolicy");

const PAGE_SIZE = 50;

/**
 * GET /complaints/:id/messages?page=1
 * Returns paginated messages (newest last) for this complaint thread.
 * Accessible to: complaint owner, assigned workers, HOD of same dept, admin.
 */
exports.getMessages = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id).select(
    "userId department assignedWorkers messages",
  );
  if (!complaint) throw new AppError("Complaint not found", 404);

  await assertCanAccessComplaint(req.user, complaint);

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const allMessages = complaint.messages || [];
  const total = allMessages.length;
  const start = Math.max(0, total - page * PAGE_SIZE);
  const end = total - (page - 1) * PAGE_SIZE;
  const messages = allMessages.slice(start, end);

  return sendSuccess(res, { messages, total, page, pageSize: PAGE_SIZE });
});

/**
 * POST /complaints/:id/messages
 * Body: { text }
 * Accessible to same roles as GET.
 */
exports.postMessage = asyncHandler(async (req, res) => {
  const text = (req.body.text || "").trim();
  if (!text) throw new AppError("Message text is required", 400);
  if (text.length > 2000) throw new AppError("Message too long (max 2000 chars)", 400);

  const complaint = await Complaint.findById(req.params.id).select(
    "userId department assignedWorkers messages",
  );
  if (!complaint) throw new AppError("Complaint not found", 404);

  await assertCanAccessComplaint(req.user, complaint);

  // Fetch sender display name from DB if not on req.user
  let senderName = req.user.name || req.user.username || "User";
  if (!senderName || senderName === "User") {
    const dbUser = await User.findById(req.user._id).select("name username");
    senderName = dbUser?.name || dbUser?.username || "User";
  }

  const message = {
    senderId: req.user._id,
    senderName,
    senderRole: req.user.role,
    text,
    createdAt: new Date(),
  };

  complaint.messages.push(message);
  await complaint.save();

  const saved = complaint.messages[complaint.messages.length - 1];
  return sendSuccess(res, { message: saved }, "Message sent", 201);
});
