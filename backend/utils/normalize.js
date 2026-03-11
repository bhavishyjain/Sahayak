// Shared utility functions used across services and controllers

function normalizeDepartment(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "in progress") return "in-progress";
  if (normalized === "canceled") return "cancelled";
  return normalized;
}

function getResolvedAt(complaint) {
  if (complaint?.resolvedAt) return new Date(complaint.resolvedAt);
  const resolvedEvent = (complaint?.history || [])
    .filter((event) => normalizeStatus(event?.status) === "resolved")
    .sort(
      (a, b) =>
        new Date(b?.timestamp || 0).getTime() -
        new Date(a?.timestamp || 0).getTime(),
    )[0];
  return resolvedEvent?.timestamp ? new Date(resolvedEvent.timestamp) : null;
}

function atStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function atStartOfWeek() {
  const date = new Date();
  date.setDate(date.getDate() - date.getDay());
  date.setHours(0, 0, 0, 0);
  return date;
}

function calculateAvgResponseTimeHours(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const total = items.reduce((sum, c) => {
    return (
      sum +
      (new Date(c.assignedAt) - new Date(c.createdAt)) / (1000 * 60 * 60)
    );
  }, 0);
  return Math.round(total / items.length);
}

module.exports = {
  normalizeDepartment,
  escapeRegex,
  normalizeStatus,
  getResolvedAt,
  atStartOfToday,
  atStartOfWeek,
  calculateAvgResponseTimeHours,
};
