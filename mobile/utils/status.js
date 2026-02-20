export function statusColor(status) {
  switch (status) {
    case "resolved":
      return "#22c55e";
    case "in-progress":
      return "#f59e0b";
    case "pending":
      return "#f97316";
    default:
      return "#64748b";
  }
}
