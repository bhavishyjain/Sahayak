const Complaint = require("../../models/Complaint");
const ComplaintMessage = require("../../models/ComplaintMessage");
const User = require("../../models/User");
const AppError = require("../../core/AppError");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const {
  assertCanParticipateInComplaintChat,
} = require("../../policies/complaintPolicy");
const {
  COMPLAINT_DOMAIN_EVENTS,
  emitComplaintDomainEvent,
} = require("../../services/complaintEventService");
const { buildListPayload, buildDetailPayload } = require("../../services/responseViewService");

const PAGE_SIZE = 50;

async function migrateEmbeddedMessagesIfNeeded(complaint) {
  if (!complaint?._id) return;
  const embeddedMessages = complaint.messages || [];
  if (embeddedMessages.length === 0) return;

  const existingCount = await ComplaintMessage.countDocuments({
    complaintId: complaint._id,
  });
  if (existingCount > 0) return;

  await ComplaintMessage.insertMany(
    embeddedMessages.map((message) => ({
      _id: message._id,
      complaintId: complaint._id,
      senderId: message.senderId,
      senderName: message.senderName,
      senderRole: message.senderRole,
      text: message.text,
      createdAt: message.createdAt,
    })),
    { ordered: true },
  );
}

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

  await assertCanParticipateInComplaintChat(req.user, complaint);

  const page = Math.max(1, parseInt(req.query.page) || 1);
  await migrateEmbeddedMessagesIfNeeded(complaint);
  const total = await ComplaintMessage.countDocuments({
    complaintId: complaint._id,
  });
  const start = Math.max(0, total - page * PAGE_SIZE);
  const limit = Math.max(0, total - (page - 1) * PAGE_SIZE - start);
  const messages = await ComplaintMessage.find({ complaintId: complaint._id })
    .sort({ createdAt: 1, _id: 1 })
    .skip(start)
    .limit(limit)
    .lean();

  return sendSuccess(
    res,
    buildListPayload({
      items: messages,
      itemKey: "messages",
      page,
      limit: PAGE_SIZE,
      total,
      legacy: { pageSize: PAGE_SIZE },
    }),
  );
});

/**
 * POST /complaints/:id/messages
 * Body: { text }
 * Accessible to same roles as GET.
 */
exports.postMessage = asyncHandler(async (req, res) => {
  const text = (req.body.text || "").trim();
  if (!text) throw new AppError("Message text is required", 400);
  if (text.length > 2000)
    throw new AppError("Message too long (max 2000 chars)", 400);

  const complaint = await Complaint.findById(req.params.id).select(
    "ticketId userId department assignedWorkers messages",
  );
  if (!complaint) throw new AppError("Complaint not found", 404);

  await assertCanParticipateInComplaintChat(req.user, complaint);

  // Fetch sender display name from DB if not on req.user
  let senderName = req.user.fullName || req.user.username || "User";
  if (!senderName || senderName === "User") {
    const dbUser = await User.findById(req.user._id).select(
      "fullName username",
    );
    senderName = dbUser?.fullName || dbUser?.username || "User";
  }

  const message = {
    senderId: req.user._id,
    senderName,
    senderRole: req.user.role,
    text,
    createdAt: new Date(),
  };

  const saved = await ComplaintMessage.create({
    complaintId: complaint._id,
    ...message,
  });
  await emitComplaintDomainEvent(
    complaint,
    COMPLAINT_DOMAIN_EVENTS.COMPLAINT_CHAT_MESSAGE,
    {
      actorId: String(req.user._id),
      senderName,
      text,
      message: saved,
      data: {
        senderId: String(req.user._id),
      },
    },
  );
  return sendSuccess(
    res,
    buildDetailPayload(saved.toObject(), "message", { message: saved }),
    "Message sent",
    201,
  );
});
