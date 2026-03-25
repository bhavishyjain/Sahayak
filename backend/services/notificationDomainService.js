const Notification = require("../models/Notification");
const { emitNotification } = require("./realtimeService");
const {
  NOTIFICATION_TYPES,
} = require("../domain/constants");

const NOTIFICATION_CONTRACT_VERSION = 1;

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

const NOTIFICATION_EVENT_CONTRACTS = Object.freeze({
  [NOTIFICATION_TYPES.COMPLAINT_UPDATE]: {
    type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
    defaultRouteScreen: NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL,
    preferenceKey: NOTIFICATION_PREFERENCE_BY_TYPE[NOTIFICATION_TYPES.COMPLAINT_UPDATE],
    persistByDefault: true,
  },
  [NOTIFICATION_TYPES.ASSIGNMENT]: {
    type: NOTIFICATION_TYPES.ASSIGNMENT,
    defaultRouteScreen: NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL,
    preferenceKey: NOTIFICATION_PREFERENCE_BY_TYPE[NOTIFICATION_TYPES.ASSIGNMENT],
    persistByDefault: true,
  },
  [NOTIFICATION_TYPES.ESCALATION]: {
    type: NOTIFICATION_TYPES.ESCALATION,
    defaultRouteScreen: NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL,
    preferenceKey: NOTIFICATION_PREFERENCE_BY_TYPE[NOTIFICATION_TYPES.ESCALATION],
    persistByDefault: true,
  },
  [NOTIFICATION_TYPES.COMPLAINT_ESCALATED]: {
    type: NOTIFICATION_TYPES.COMPLAINT_ESCALATED,
    defaultRouteScreen: NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL,
    preferenceKey:
      NOTIFICATION_PREFERENCE_BY_TYPE[NOTIFICATION_TYPES.COMPLAINT_ESCALATED],
    persistByDefault: true,
  },
  [NOTIFICATION_TYPES.CHAT_MESSAGE]: {
    type: NOTIFICATION_TYPES.CHAT_MESSAGE,
    defaultRouteScreen: NOTIFICATION_ROUTE_SCREENS.COMPLAINT_CHAT,
    preferenceKey: null,
    persistByDefault: false,
  },
  [NOTIFICATION_TYPES.SYSTEM]: {
    type: NOTIFICATION_TYPES.SYSTEM,
    defaultRouteScreen: null,
    preferenceKey: NOTIFICATION_PREFERENCE_BY_TYPE[NOTIFICATION_TYPES.SYSTEM],
    persistByDefault: true,
  },
  [NOTIFICATION_TYPES.TEST]: {
    type: NOTIFICATION_TYPES.TEST,
    defaultRouteScreen: null,
    preferenceKey: null,
    persistByDefault: true,
  },
  [NOTIFICATION_TYPES.OTHER]: {
    type: NOTIFICATION_TYPES.OTHER,
    defaultRouteScreen: null,
    preferenceKey: null,
    persistByDefault: true,
  },
});

function normalizeNotificationType(type) {
  const normalized = String(type || "").trim();
  if (!normalized) return NOTIFICATION_TYPES.OTHER;
  return Object.values(NOTIFICATION_TYPES).includes(normalized)
    ? normalized
    : NOTIFICATION_TYPES.OTHER;
}

function getNotificationEventContract(type) {
  const normalizedType = normalizeNotificationType(type);
  return (
    NOTIFICATION_EVENT_CONTRACTS[normalizedType] ||
    NOTIFICATION_EVENT_CONTRACTS[NOTIFICATION_TYPES.OTHER]
  );
}

function shouldDeliverByPreference(preferences = {}, type) {
  const preferenceKey = NOTIFICATION_PREFERENCE_BY_TYPE[type];
  if (!preferenceKey) return true;
  return preferences[preferenceKey] !== false;
}

function shouldPersistNotification({ saveHistory = true, type }) {
  if (!saveHistory) return false;
  return getNotificationEventContract(type).persistByDefault !== false;
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
  const contract = getNotificationEventContract(type);

  if (contract.defaultRouteScreen) {
    return buildNotificationRoute(
      contract.defaultRouteScreen,
      { complaintId, ticketId },
    );
  }

  return null;
}

function buildNotificationPayload({ title, body, data = {} } = {}) {
  const type = normalizeNotificationType(data?.type);
  const contract = getNotificationEventContract(type);
  return {
    title: title || "Notification",
    body: body || "",
    data: {
      ...data,
      contractVersion: NOTIFICATION_CONTRACT_VERSION,
      type,
      preferenceKey: contract.preferenceKey || null,
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
  NOTIFICATION_CONTRACT_VERSION,
  NOTIFICATION_EVENT_CONTRACTS,
  NOTIFICATION_PREFERENCE_BY_TYPE,
  normalizeNotificationType,
  getNotificationEventContract,
  shouldDeliverByPreference,
  shouldPersistNotification,
  buildNotificationPayload,
  buildNotificationRoute,
  inferNotificationRoute,
  NOTIFICATION_ROUTE_SCREENS,
  persistNotification,
};
