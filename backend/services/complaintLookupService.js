const Complaint = require("../models/Complaint");
const { canAccessComplaint } = require("../policies/complaintPolicy");
const { buildComplaintSearchConditions } = require("./complaintQueryService");

function wantsRecentComplaints(message = "") {
  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("meri complaint") ||
    lower.includes("meri complaints") ||
    lower.includes("meri shikayat") ||
    lower.includes("my complaint") ||
    lower.includes("my complaints") ||
    lower.includes("recent complaint") ||
    lower.includes("complaint history")
  );
}

function extractTicketId(message = "") {
  const match = String(message || "").match(/\b[A-Z]{2,5}\d{3,8}\b/i);
  return match ? match[0].toUpperCase() : null;
}

async function findRecentComplaintsForUser(userId, limit = 5) {
  if (!userId) return [];
  return Complaint.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("ticketId status department priority createdAt");
}

async function findComplaintByTicketId(ticketId) {
  const normalized = String(ticketId || "").trim().toUpperCase();
  if (!normalized) return null;
  return Complaint.findOne({ ticketId: normalized });
}

async function searchComplaintsForUser(userId, search, limit = 10) {
  if (!userId) return [];
  const conditions = buildComplaintSearchConditions(search);
  const query = { userId };
  if (conditions.length > 0) {
    query.$or = conditions;
  }
  return Complaint.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("ticketId status department priority createdAt locationName");
}

async function canUserAccessComplaint(user, complaint) {
  return canAccessComplaint(user, complaint);
}

module.exports = {
  wantsRecentComplaints,
  extractTicketId,
  findRecentComplaintsForUser,
  findComplaintByTicketId,
  searchComplaintsForUser,
  canUserAccessComplaint,
};
