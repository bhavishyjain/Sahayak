module.exports = function generateTicketId() {
  const base = Date.now().toString(36).toUpperCase();
  return `CMP-${base}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
};
