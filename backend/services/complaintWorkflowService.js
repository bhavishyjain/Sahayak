const {
  emitComplaintParticipantRealtime,
  notifyComplaintParticipants,
} = require("./complaintAudienceService");
const AppError = require("../core/AppError");
const {
  NOTIFICATION_TYPES,
  ROLES,
} = require("../domain/constants");
const {
  NOTIFICATION_ROUTE_SCREENS,
  buildNotificationRoute,
} = require("./notificationDomainService");

const COMPLAINT_STATUS_TRANSITIONS = Object.freeze({
  [ROLES.WORKER]: {
    assigned: ["in-progress", "pending-approval"],
    "in-progress": ["pending-approval"],
    "needs-rework": ["in-progress", "pending-approval"],
  },
  [ROLES.HEAD]: {
    pending: ["cancelled"],
    assigned: ["cancelled"],
    "in-progress": ["cancelled"],
    "pending-approval": ["resolved", "needs-rework", "cancelled"],
    "needs-rework": ["cancelled"],
  },
  [ROLES.ADMIN]: {
    pending: ["cancelled"],
    assigned: ["cancelled"],
    "in-progress": ["cancelled"],
    "pending-approval": ["resolved", "needs-rework", "cancelled"],
    "needs-rework": ["cancelled"],
  },
});

function buildHistoryNote({
  actorLabel = "System",
  nextStatus,
  reason = "",
  note,
}) {
  if (note) return String(note).trim();
  const statusLabel = String(nextStatus || "").replace(/-/g, " ");
  if (reason) {
    return `${actorLabel} set status to ${statusLabel}: ${reason}`;
  }
  return `${actorLabel} set status to ${statusLabel}`;
}

function appendComplaintHistory(
  complaint,
  { status, updatedBy = null, note, timestamp = new Date() },
) {
  complaint.history.push({
    status,
    updatedBy,
    timestamp,
    note,
  });
}

function assertComplaintTransitionAllowed({
  actorRole,
  currentStatus,
  nextStatus,
}) {
  const allowedTransitions =
    COMPLAINT_STATUS_TRANSITIONS[actorRole]?.[currentStatus] || [];
  if (!allowedTransitions.includes(nextStatus)) {
    throw new AppError(
      `Invalid status transition from ${currentStatus} to ${nextStatus}`,
      400,
    );
  }
}

function applyComplaintTransition(
  complaint,
  {
    actorRole,
    actorId = null,
    actorLabel,
    nextStatus,
    reason = "",
    note,
    timestamp = new Date(),
    validateTransition = true,
  },
) {
  const currentStatus = complaint.status;

  if (validateTransition) {
    assertComplaintTransitionAllowed({
      actorRole,
      currentStatus,
      nextStatus,
    });
  }

  complaint.status = nextStatus;
  if (nextStatus === "resolved") {
    complaint.resolvedAt = complaint.resolvedAt || timestamp;
  } else if (currentStatus === "resolved" && nextStatus !== "resolved") {
    complaint.resolvedAt = null;
  }

  appendComplaintHistory(complaint, {
    status: nextStatus,
    updatedBy: actorId,
    note: buildHistoryNote({
      actorLabel,
      nextStatus,
      reason,
      note,
    }),
    timestamp,
  });
}

async function broadcastComplaintStatusChange(
  complaint,
  {
    actorId,
    status,
    body,
    type = NOTIFICATION_TYPES.COMPLAINT_UPDATE,
    includeHeads = false,
    event = "status-changed",
  },
) {
  await notifyComplaintParticipants(
    complaint,
    {
      title: "Complaint Status Updated",
      body,
      data: {
        type,
        complaintId: String(complaint._id),
        ticketId: complaint.ticketId,
        status,
        route: buildNotificationRoute(
          NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL,
          {
            complaintId: String(complaint._id),
            ticketId: complaint.ticketId,
          },
        ),
      },
    },
    { excludeUserIds: [actorId], includeHeads },
  );

  await emitComplaintParticipantRealtime(complaint, event, actorId);
}

module.exports = {
  COMPLAINT_STATUS_TRANSITIONS,
  buildHistoryNote,
  appendComplaintHistory,
  assertComplaintTransitionAllowed,
  applyComplaintTransition,
  broadcastComplaintStatusChange,
};
