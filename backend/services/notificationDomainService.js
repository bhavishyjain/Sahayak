const Notification = require("../models/Notification");
const { emitNotification } = require("./realtimeService");
const {
  NOTIFICATION_TYPES,
} = require("../domain/constants");

const NOTIFICATION_ROUTE_SCREENS = Object.freeze({
  COMPLAINT_DETAIL: "complaint-detail",
  COMPLAINT_CHAT: "complaint-chat",
  AI_REVIEW: "ai-review",
  WORKER_ASSIGNMENT: "worker-assignment",
});

const NOTIFICATION_PREFERENCE_BY_TYPE = Object.freeze({
  [NOTIFICATION_TYPES.COMPLAINT_UPDATE]: "complaintsUpdates",
  [NOTIFICATION_TYPES.ASSIGNMENT]: "assignments",
  [NOTIFICATION_TYPES.ESCALATION]: "escalations",
  [NOTIFICATION_TYPES.COMPLAINT_ESCALATED]: "escalations",
  [NOTIFICATION_TYPES.SYSTEM]: "systemAlerts",
});

function normalizeNotificationType(type) {
  const normalized = String(type || "").trim();
  if (!normalized) return NOTIFICATION_TYPES.OTHER;
  return Object.values(NOTIFICATION_TYPES).includes(normalized)
    ? normalized
    : NOTIFICATION_TYPES.OTHER;
}

function shouldDeliverByPreference(preferences = {}, type) {
  const preferenceKey = NOTIFICATION_PREFERENCE_BY_TYPE[type];
  if (!preferenceKey) return true;
  return preferences[preferenceKey] !== false;
}

function shouldPersistNotification({ saveHistory = true, type }) {
  if (!saveHistory) return false;
  return type !== NOTIFICATION_TYPES.CHAT_MESSAGE;
}

function buildNotificationRoute(screen, params = {}) {
  if (!screen) return null;
  const normalizedParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === "") return acc;
    acc[key] = String(value);
    return acc;
  }, {});

  return {
    screen,
    params: normalizedParams,
  };
}

function inferNotificationRoute(data = {}) {
  if (data?.route?.screen) {
    return buildNotificationRoute(
      data.route.screen,
      data.route.params || data.route,
    );
  }

  const complaintId = data?.complaintId;
  const ticketId = data?.ticketId;
  const type = normalizeNotificationType(data?.type);

  if (type === NOTIFICATION_TYPES.CHAT_MESSAGE) {
    return buildNotificationRoute(
      NOTIFICATION_ROUTE_SCREENS.COMPLAINT_CHAT,
      { complaintId, ticketId },
    );
  }

  if (
    [
      NOTIFICATION_TYPES.COMPLAINT_UPDATE,
      NOTIFICATION_TYPES.COMPLAINT_ESCALATED,
      NOTIFICATION_TYPES.ESCALATION,
      NOTIFICATION_TYPES.ASSIGNMENT,
    ].includes(type)
  ) {
    return buildNotificationRoute(
      NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL,
      { complaintId, ticketId },
    );
  }

  return null;
}

function buildNotificationPayload({ title, body, data = {} } = {}) {
  const type = normalizeNotificationType(data?.type);
  return {
    title: title || "Notification",
    body: body || "",
    data: {
      ...data,
      type,
      route: inferNotificationRoute({ ...data, type }),
    },
  };
}

async function persistNotification(userId, payload) {
  const notification = await Notification.create({
    userId,
    title: payload.title,
    body: payload.body,
    type: normalizeNotificationType(payload.data?.type),
    data: payload.data || {},
  });

  emitNotification(userId, {
    notification,
    unread: true,
  });

  return notification;
}

module.exports = {
  NOTIFICATION_PREFERENCE_BY_TYPE,
  normalizeNotificationType,
  shouldDeliverByPreference,
  shouldPersistNotification,
  buildNotificationPayload,
  buildNotificationRoute,
  inferNotificationRoute,
  NOTIFICATION_ROUTE_SCREENS,
  persistNotification,
};
