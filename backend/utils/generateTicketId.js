module.exports = function generateTicketId() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();

  return `CMP-${yyyy}${mm}${dd}-${hh}${min}-${random}`;
};
