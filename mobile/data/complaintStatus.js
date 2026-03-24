import {
  AlertCircle,
  CheckCircle,
  ClipboardCheck,
  Clock,
  RotateCcw,
  UserCheck,
  Wrench,
  XCircle,
} from "lucide-react-native";

export const COMPLAINT_STATUS_META = {
  pending: {
    translationKey: "status.pending",
    fallbackLabel: "Pending",
    colorRole: "statusPending",
    icon: Clock,
  },
  assigned: {
    translationKey: "status.assigned",
    fallbackLabel: "Assigned",
    colorRole: "statusAssigned",
    icon: UserCheck,
  },
  "in-progress": {
    translationKey: "status.inProgress",
    fallbackLabel: "In Progress",
    colorRole: "statusInProgress",
    icon: Wrench,
  },
  "pending-approval": {
    translationKey: "complaints.status.pendingApproval",
    fallbackLabel: "Pending Approval",
    colorRole: "statusPendingApproval",
    icon: ClipboardCheck,
  },
  "needs-rework": {
    translationKey: "status.needsRework",
    fallbackLabel: "Needs Rework",
    colorRole: "statusNeedsRework",
    icon: RotateCcw,
  },
  resolved: {
    translationKey: "status.resolved",
    fallbackLabel: "Resolved",
    colorRole: "statusResolved",
    icon: CheckCircle,
  },
  cancelled: {
    translationKey: "status.cancelled",
    fallbackLabel: "Cancelled",
    colorRole: "statusCancelled",
    icon: XCircle,
  },
};

export const CANONICAL_COMPLAINT_STATUSES = Object.keys(COMPLAINT_STATUS_META);

export function normalizeComplaintStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function getComplaintStatusMeta(status) {
  const normalized = normalizeComplaintStatus(status);
  return COMPLAINT_STATUS_META[normalized] ?? null;
}

export function getComplaintStatusTranslationKey(status) {
  return getComplaintStatusMeta(status)?.translationKey ?? null;
}

export function getStatusColor(status, colors) {
  const meta = getComplaintStatusMeta(status);
  if (!meta) return undefined;
  return colors?.[meta.colorRole];
}

export function getStatusIcon(status) {
  return getComplaintStatusMeta(status)?.icon ?? AlertCircle;
}

export function getStatusBackgroundColor(status, colors, alpha = "22") {
  const color = getStatusColor(status, colors);
  return color ? `${color}${alpha}` : undefined;
}

export const ALL_STATUS_OPTIONS = [...CANONICAL_COMPLAINT_STATUSES];
export const WORKER_ACTIONABLE_STATUSES = [
  "assigned",
  "in-progress",
  "needs-rework",
];
export const HEAD_MANAGE_BLOCKED_STATUSES = [
  "resolved",
  "cancelled",
  "pending-approval",
];

export function normalizeStatus(status) {
  return normalizeComplaintStatus(status);
}

function formatFallbackStatusLabel(status) {
  return String(status || "-")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatStatusLabel(t, status) {
  const key = getComplaintStatusTranslationKey(status);
  if (!key) return formatFallbackStatusLabel(status);
  if (typeof t === "function") return t(key);
  return (
    getComplaintStatusMeta(status)?.fallbackLabel ??
    formatFallbackStatusLabel(status)
  );
}

export const COMPLAINT_PRIORITY_META = {
  low: {
    backendValue: "Low",
    translationKey: "complaints.priority.low",
    fallbackLabel: "Low",
    colorRole: "priorityLow",
  },
  medium: {
    backendValue: "Medium",
    translationKey: "complaints.priority.medium",
    fallbackLabel: "Medium",
    colorRole: "priorityMedium",
  },
  high: {
    backendValue: "High",
    translationKey: "complaints.priority.high",
    fallbackLabel: "High",
    colorRole: "priorityHigh",
  },
};

export const CANONICAL_COMPLAINT_PRIORITIES = Object.values(
  COMPLAINT_PRIORITY_META,
).map((item) => item.backendValue);

export function normalizeComplaintPriority(priority) {
  return String(priority || "")
    .trim()
    .toLowerCase();
}

export function getComplaintPriorityMeta(priority) {
  const normalized = normalizeComplaintPriority(priority);
  return COMPLAINT_PRIORITY_META[normalized] ?? null;
}

export function getComplaintPriorityTranslationKey(priority) {
  return getComplaintPriorityMeta(priority)?.translationKey ?? null;
}

export function getPriorityColor(priority, colors) {
  const meta = getComplaintPriorityMeta(priority);
  if (!meta) return undefined;
  return colors?.[meta.colorRole];
}

export function getPriorityBackgroundColor(priority, colors, alpha = "22") {
  const color = getPriorityColor(priority, colors);
  return color ? `${color}${alpha}` : undefined;
}

export function normalizePriority(priority) {
  return normalizeComplaintPriority(priority);
}

export function formatPriorityLabel(t, priority) {
  const key = getComplaintPriorityTranslationKey(priority);
  if (!key) return priority || "-";
  if (typeof t === "function") return t(key);
  return getComplaintPriorityMeta(priority)?.fallbackLabel ?? priority ?? "-";
}
