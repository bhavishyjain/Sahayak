export function normalizeStatus(status) {
  return String(status || "").toLowerCase().replace(/\s+/g, "-");
}

export function normalizePriority(priority) {
  return String(priority || "").trim().toLowerCase();
}

export function isComplaintAssigned(complaint) {
  if (!complaint || typeof complaint !== "object") return false;
  if (Array.isArray(complaint.assignedWorkers)) {
    return complaint.assignedWorkers.length > 0;
  }
  if (typeof complaint.assignmentCount === "number") {
    return complaint.assignmentCount > 0;
  }
  return Boolean(complaint.assignedTo);
}

export function formatEtaFromHours(etaHours, assignedAt, overdueText) {
  const totalHours = Number(etaHours);
  if (!Number.isFinite(totalHours) || totalHours <= 0) return null;

  let remainingHours = totalHours;
  if (assignedAt) {
    const assignedDate = new Date(assignedAt);
    if (!Number.isNaN(assignedDate.getTime())) {
      const elapsedHours =
        (Date.now() - assignedDate.getTime()) / (1000 * 60 * 60);
      remainingHours = Math.round(totalHours - elapsedHours);
    }
  }

  if (remainingHours < 0) return overdueText;
  if (remainingHours < 24) return `${remainingHours}h`;
  return `${Math.round(remainingHours / 24)}d`;
}

export function formatDateShort(dateString, locale = "en-US") {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_TRANSLATION_KEYS = {
  pending: "status.pending",
  assigned: "status.assigned",
  "in-progress": "status.inProgress",
  "pending-approval": "complaints.status.pendingApproval",
  "needs-rework": "status.needsRework",
  resolved: "status.resolved",
  cancelled: "status.cancelled",
};

export function formatStatusLabel(t, status) {
  const key = STATUS_TRANSLATION_KEYS[normalizeStatus(status)];
  if (!key) return status || "-";
  return t(key);
}

const PRIORITY_TRANSLATION_KEYS = {
  low: "complaints.priority.low",
  medium: "complaints.priority.medium",
  high: "complaints.priority.high",
};

export function formatPriorityLabel(t, priority) {
  const normalized = normalizePriority(priority);
  const key = PRIORITY_TRANSLATION_KEYS[normalized];
  if (!key) return priority || "-";
  return t(key);
}
