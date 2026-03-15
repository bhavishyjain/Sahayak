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

export function getSlaCountdown(dueDateStr) {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  if (Number.isNaN(due.getTime())) return null;

  const now = new Date();
  const diffMs = due.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { text: null, isOverdue: true, isCritical: true, isUrgent: false };
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = diffMs / 3600000;
  const diffDays = diffHours / 24;
  const isCritical = diffHours < 4;
  const isUrgent = diffHours < 24;

  if (diffDays >= 1) {
    const days = Math.floor(diffDays);
    const hours = Math.floor(diffHours % 24);
    return {
      text: hours > 0 ? `${days}d ${hours}h` : `${days}d`,
      isOverdue: false,
      isCritical,
      isUrgent,
    };
  }

  if (diffHours >= 1) {
    const hours = Math.floor(diffHours);
    const mins = diffMins % 60;
    return {
      text: mins > 0 ? `${hours}h ${mins}m` : `${hours}h`,
      isOverdue: false,
      isCritical,
      isUrgent,
    };
  }

  return {
    text: `${diffMins}m`,
    isOverdue: false,
    isCritical: true,
    isUrgent: true,
  };
}

export function normalizeSeverity(severity) {
  const normalized = String(severity || "")
    .trim()
    .toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "low") return "low";
  return "low";
}

export function getSeverityName(t, severity) {
  const normalized = normalizeSeverity(severity);

  if (typeof t !== "function") return normalized;

  if (normalized === "critical") return t("heatmap.severity.critical");
  if (normalized === "high") return t("heatmap.severity.high");
  if (normalized === "medium") return t("heatmap.severity.medium");
  return t("heatmap.severity.low");
}

export function getSeverityColor(severity, colors) {
  const normalized = normalizeSeverity(severity);

  if (normalized === "critical") return colors?.danger;
  if (normalized === "high") return colors?.warning;
  if (normalized === "medium") return colors?.primary;
  return colors?.success;
}
