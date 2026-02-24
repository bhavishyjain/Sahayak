/**
 * Get color for complaint status
 * @param {string} status - The status value
 * @param {object} colors - The color scheme object
 * @returns {string} The color value
 */
export function getStatusColor(status, colors) {
  const s = String(status || "").toLowerCase();
  if (s === "resolved") return colors.success;
  if (s === "in-progress" || s === "assigned") return colors.warning;
  if (s === "pending") return colors.danger;
  return colors.muted;
}

/**
 * Get color for priority level
 * @param {string} priority - The priority value
 * @param {object} colors - The color scheme object
 * @returns {string} The color value
 */
export function getPriorityColor(priority, colors) {
  const p = String(priority || "").toLowerCase();
  if (p === "high") return colors.danger;
  if (p === "medium") return colors.warning;
  if (p === "low") return colors.success;
  return colors.muted;
}

/**
 * Get color for severity level (for hotspots)
 * @param {string} severity - The severity value
 * @param {object} colors - The color scheme object
 * @returns {string} The color value
 */
export function getSeverityColor(severity, colors) {
  const s = String(severity || "").toLowerCase();
  if (s === "very-high") return colors.danger;
  if (s === "high") return "#ff9800";
  if (s === "medium") return colors.primary;
  return colors.success;
}
