const {
  deliverNotificationBatch,
} = require("./notificationDeliveryService");
const {
  NOTIFICATION_TYPES,
} = require("../domain/constants");
const {
  buildNotificationRoute,
  NOTIFICATION_ROUTE_SCREENS,
} = require("./notificationDomainService");
const { getComplaintParticipantIds } = require("./complaintAudienceService");
const {
  emitComplaintMessage,
  emitComplaintUpdated,
} = require("./realtimeService");

const COMPLAINT_DOMAIN_EVENTS = Object.freeze({
  COMPLAINT_CREATED: "complaint_created",
  COMPLAINT_ASSIGNED: "complaint_assigned",
  WORKER_STARTED: "worker_started",
  SUBMITTED_FOR_APPROVAL: "submitted_for_approval",
  REWORK_REQUESTED: "rework_requested",
  COMPLAINT_RESOLVED: "complaint_resolved",
  COMPLAINT_CANCELLED: "complaint_cancelled",
  COMPLAINT_CHAT_MESSAGE: "complaint_chat_message",
  TASK_UPDATED: "task_updated",
});

const COMPLAINT_EVENT_DEFINITIONS = Object.freeze({
  [COMPLAINT_DOMAIN_EVENTS.COMPLAINT_CREATED]: {
    title: "Complaint Received",
    type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
    includeHeads: false,
    saveHistory: true,
    realtimeEvent: "complaint-created",
    buildBody: ({ complaint }) =>
      `Ticket ${complaint.ticketId} has been created.`,
  },
  [COMPLAINT_DOMAIN_EVENTS.COMPLAINT_ASSIGNED]: {
    title: "Complaint Assignment Updated",
    type: NOTIFICATION_TYPES.ASSIGNMENT,
    includeHeads: false,
    saveHistory: true,
    realtimeEvent: "complaint-assigned",
    buildBody: ({ complaint }) =>
      `Complaint #${complaint.ticketId} assignment has been updated.`,
  },
  [COMPLAINT_DOMAIN_EVENTS.WORKER_STARTED]: {
    title: "Complaint Status Updated",
    type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
    includeHeads: true,
    saveHistory: true,
    realtimeEvent: "worker-started",
    buildBody: ({ complaint, status }) =>
      `Complaint #${complaint.ticketId} is now ${String(
        status || complaint.status,
      ).replace(/-/g, " ")}.`,
  },
  [COMPLAINT_DOMAIN_EVENTS.SUBMITTED_FOR_APPROVAL]: {
    title: "Complaint Status Updated",
    type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
    includeHeads: true,
    saveHistory: true,
    realtimeEvent: "submitted-for-approval",
    buildBody: ({ complaint }) =>
      `Complaint #${complaint.ticketId} is awaiting approval.`,
  },
  [COMPLAINT_DOMAIN_EVENTS.REWORK_REQUESTED]: {
    title: "Complaint Status Updated",
    type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
    includeHeads: false,
    saveHistory: true,
    realtimeEvent: "rework-requested",
    buildBody: ({ complaint, reason }) =>
      reason
        ? `Complaint #${complaint.ticketId} needs rework: ${reason}`
        : `Complaint #${complaint.ticketId} needs rework.`,
  },
  [COMPLAINT_DOMAIN_EVENTS.COMPLAINT_RESOLVED]: {
    title: "Complaint Status Updated",
    type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
    includeHeads: false,
    saveHistory: true,
    realtimeEvent: "complaint-resolved",
    buildBody: ({ complaint }) =>
      `Complaint #${complaint.ticketId} has been marked as resolved.`,
  },
  [COMPLAINT_DOMAIN_EVENTS.COMPLAINT_CANCELLED]: {
    title: "Complaint Status Updated",
    type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
    includeHeads: false,
    saveHistory: true,
    realtimeEvent: "complaint-cancelled",
    buildBody: ({ complaint }) =>
      `Complaint #${complaint.ticketId} has been cancelled.`,
  },
  [COMPLAINT_DOMAIN_EVENTS.COMPLAINT_CHAT_MESSAGE]: {
    title: "New message",
    type: NOTIFICATION_TYPES.CHAT_MESSAGE,
    includeHeads: true,
    saveHistory: false,
    realtimeMode: "message",
    buildBody: ({ senderName, text }) => {
      const preview =
        String(text || "").length > 120
          ? `${String(text).slice(0, 117)}...`
          : String(text || "");
      return `${senderName || "User"}: ${preview}`;
    },
    buildRoute: ({ complaint }) =>
      buildNotificationRoute(NOTIFICATION_ROUTE_SCREENS.COMPLAINT_CHAT, {
        complaintId: String(complaint._id),
        ticketId: complaint.ticketId,
      }),
  },
  [COMPLAINT_DOMAIN_EVENTS.TASK_UPDATED]: {
    title: "Complaint Status Updated",
    type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
    includeHeads: false,
    saveHistory: true,
    realtimeEvent: "task-updated",
    buildBody: ({ complaint }) =>
      `Task details for complaint #${complaint.ticketId} were updated.`,
  },
});

function defaultComplaintDetailRoute(complaint) {
  return buildNotificationRoute(NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL, {
    complaintId: String(complaint?._id || ""),
    ticketId: complaint?.ticketId,
  });
}

function normalizeRecipientIds(userIds = []) {
  return [...new Set(userIds.map((value) => String(value || "").trim()).filter(Boolean))];
}

function buildComplaintEventPayload(complaint, eventName, context = {}) {
  const definition = COMPLAINT_EVENT_DEFINITIONS[eventName];
  if (!definition || !complaint) return null;

  const title = context.title || definition.title;
  const body =
    context.body ||
    definition.buildBody?.({
      complaint,
      ...context,
    }) ||
    "";
  const route =
    context.route ||
    definition.buildRoute?.({
      complaint,
      ...context,
    }) ||
    defaultComplaintDetailRoute(complaint);
  const type = context.type || definition.type;

  return {
    title,
    body,
    data: {
      type,
      event: eventName,
      complaintId: String(complaint._id),
      ticketId: complaint.ticketId,
      status: context.status || complaint.status,
      route,
      ...context.data,
    },
  };
}

async function resolveComplaintEventRecipients(complaint, eventName, context = {}) {
  const definition = COMPLAINT_EVENT_DEFINITIONS[eventName];
  if (!definition) return [];

  if (Array.isArray(context.recipientUserIds) && context.recipientUserIds.length > 0) {
    return normalizeRecipientIds(context.recipientUserIds);
  }

  return getComplaintParticipantIds(complaint, {
    includeHeads:
      context.includeHeads === undefined
        ? definition.includeHeads
        : context.includeHeads,
    excludeUserIds:
      context.excludeUserIds ||
      (context.actorId ? [context.actorId] : []),
  });
}

async function deliverComplaintEventNotifications(
  recipientIds,
  payload,
  { saveHistory } = {},
) {
  await deliverNotificationBatch(recipientIds, payload, { saveHistory });
}

async function emitComplaintEventRealtime(
  complaint,
  eventName,
  recipientIds,
  context = {},
) {
  const definition = COMPLAINT_EVENT_DEFINITIONS[eventName];
  if (!definition || !complaint) return;

  if (definition.realtimeMode === "message") {
    emitComplaintMessage({
      complaintId: String(complaint._id),
      message: context.message,
      userIds: normalizeRecipientIds([context.actorId, ...recipientIds]),
    });
    return;
  }

  await emitComplaintUpdated({
    complaint,
    actorId: context.actorId || null,
    event: context.realtimeEvent || definition.realtimeEvent || eventName,
    extra: context.realtimeExtra || {},
  });
}

async function emitComplaintDomainEvent(complaint, eventName, context = {}) {
  const definition = COMPLAINT_EVENT_DEFINITIONS[eventName];
  if (!definition || !complaint) return { recipientIds: [], payload: null };

  const payload = buildComplaintEventPayload(complaint, eventName, context);
  const recipientIds = await resolveComplaintEventRecipients(
    complaint,
    eventName,
    context,
  );

  await deliverComplaintEventNotifications(recipientIds, payload, {
    saveHistory:
      context.saveHistory === undefined
        ? definition.saveHistory
        : context.saveHistory,
  });
  await emitComplaintEventRealtime(complaint, eventName, recipientIds, context);

  return {
    recipientIds,
    payload,
  };
}

module.exports = {
  COMPLAINT_DOMAIN_EVENTS,
  buildComplaintEventPayload,
  emitComplaintDomainEvent,
};
