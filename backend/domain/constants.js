const ROLES = Object.freeze({
  USER: "user",
  WORKER: "worker",
  HEAD: "head",
  ADMIN: "admin",
});

const COMPLAINT_PRIORITIES = Object.freeze(["Low", "Medium", "High"]);

const COMPLAINT_STATUSES = Object.freeze([
  "pending",
  "assigned",
  "in-progress",
  "pending-approval",
  "resolved",
  "cancelled",
  "needs-rework",
]);

const ACTIVE_COMPLAINT_STATUSES = Object.freeze([
  "pending",
  "assigned",
  "in-progress",
  "pending-approval",
  "needs-rework",
]);

const NOTIFICATION_TYPES = Object.freeze({
  COMPLAINT_UPDATE: "complaint-update",
  ASSIGNMENT: "assignment",
  ESCALATION: "escalation",
  COMPLAINT_ESCALATED: "complaint_escalated",
  SYSTEM: "system",
  CHAT_MESSAGE: "chat-message",
  TEST: "test",
  OTHER: "other",
});

module.exports = {
  ROLES,
  COMPLAINT_PRIORITIES,
  COMPLAINT_STATUSES,
  ACTIVE_COMPLAINT_STATUSES,
  NOTIFICATION_TYPES,
};
