const User = require("../models/User");
const { notifyUser } = require("../controllers/notificationController");
const {
  emitComplaintMessage,
  emitComplaintUpdated,
} = require("./realtimeService");
const {
  NOTIFICATION_ROUTE_SCREENS,
  buildNotificationRoute,
} = require("./notificationDomainService");

async function getComplaintParticipantIds(complaint, options = {}) {
  const { includeHeads = true, excludeUserIds = [] } = options;
  const participantIds = new Set();

  if (complaint?.userId) {
    participantIds.add(String(complaint.userId));
  }

  (complaint?.assignedWorkers || []).forEach((assignment) => {
    if (assignment?.workerId) {
      participantIds.add(String(assignment.workerId));
    }
  });

  if (includeHeads && complaint?.department) {
    const heads = await User.find({
      role: "head",
      department: complaint.department,
    }).select("_id");
    heads.forEach((head) => participantIds.add(String(head._id)));
  }

  excludeUserIds
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((id) => participantIds.delete(id));

  return [...participantIds];
}

async function notifyComplaintParticipants(
  complaint,
  payload,
  options = {},
) {
  const participantIds = await getComplaintParticipantIds(complaint, options);
  await Promise.all(
    participantIds.map((recipientId) =>
      notifyUser(recipientId, payload, options),
    ),
  );
  return participantIds;
}

async function emitComplaintParticipantRealtime(
  complaint,
  event,
  actorId = null,
  extra = {},
) {
  return emitComplaintUpdated({
    complaint,
    actorId,
    event,
    extra,
  });
}

async function notifyComplaintChatParticipants(
  complaint,
  {
    actorId,
    senderName,
    text,
    message,
  } = {},
) {
  const complaintId = String(complaint?._id || "");
  const ticketId = complaint?.ticketId;
  const preview =
    String(text || "").length > 120
      ? `${String(text).slice(0, 117)}...`
      : String(text || "");
  const recipientIds = await getComplaintParticipantIds(complaint, {
    excludeUserIds: [actorId],
  });

  await Promise.all(
    recipientIds.map((recipientId) =>
      notifyUser(
        recipientId,
        {
          title: `New message on #${ticketId}`,
          body: `${senderName}: ${preview}`,
          data: {
            type: "chat-message",
            complaintId,
            ticketId,
            senderId: String(actorId || ""),
            route: buildNotificationRoute(
              NOTIFICATION_ROUTE_SCREENS.COMPLAINT_CHAT,
              { complaintId, ticketId },
            ),
          },
        },
        { saveHistory: false },
      ),
    ),
  );

  emitComplaintMessage({
    complaintId,
    message,
    userIds: [actorId, ...recipientIds].filter(Boolean),
  });

  return recipientIds;
}

module.exports = {
  getComplaintParticipantIds,
  notifyComplaintParticipants,
  emitComplaintParticipantRealtime,
  notifyComplaintChatParticipants,
};
