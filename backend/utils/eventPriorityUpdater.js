const cron = require("node-cron");
const Complaint = require("../models/Complaint");
const FestivalEvent = require("../models/FestivalEvent");
const { escapeRegex } = require("./normalize");

// JSON file used as seed / fallback only — primary source is FestivalEvent collection
let jsonFallback = [];
try {
  jsonFallback = require("./festivalEvents.json");
} catch (err) {
  console.warn("[event-priority] Could not load festivalEvents.json:", err.message);
}

const EVENT_TIMEZONE = process.env.EVENT_TIMEZONE || "Asia/Kolkata";

function formatDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeEvent(event) {
  const startDate = event.startDate || event.date;
  const endDate = event.endDate || startDate;
  const locations = event.highPriorityLocations || event.locations || [];
  const priority = event.priority || "High";
  return {
    name: event.name || "Special Event",
    startDate,
    endDate,
    locations,
    priority,
  };
}

function isDateWithinRange(dateText, startDate, endDate) {
  if (!startDate) return false;
  const start = String(startDate);
  const end = String(endDate || startDate);
  return dateText >= start && dateText <= end;
}


async function runEventPriorityUpdate() {
  const today = formatDateInTimeZone(new Date(), EVENT_TIMEZONE);
  console.log(
    `[event-priority] Running update for ${today} (${EVENT_TIMEZONE})`,
  );

  // Load events from DB; fall back to JSON if DB is empty (e.g. fresh deploy)
  let dbEvents = await FestivalEvent.find({ isActive: true }).lean();
  if (dbEvents.length === 0 && jsonFallback.length > 0) {
    console.log("[event-priority] DB has no events, using festivalEvents.json fallback");
    dbEvents = jsonFallback;
  }

  for (const rawEvent of dbEvents) {
    const event = normalizeEvent(rawEvent);
    if (!isDateWithinRange(today, event.startDate, event.endDate)) {
      continue;
    }

    console.log(`[event-priority] Active event: ${event.name}`);

    for (const location of event.locations) {
      const locationPattern = new RegExp(`^${escapeRegex(location)}$`, "i");
      const result = await Complaint.updateMany(
        {
          locationName: locationPattern,
          status: { $nin: ["resolved", "cancelled"] },
        },
        { $set: { priority: event.priority } },
      );
      console.log(
        `[event-priority] Updated ${result.modifiedCount} complaints at ${location} -> ${event.priority}`,
      );
    }
  }
}

function start() {
  cron.schedule("0 2 */2 * *", async () => {
    try {
      await runEventPriorityUpdate();
    } catch (error) {
      console.error("[event-priority] Update failed:", error.message);
    }
  });
  console.log("[event-priority] Cron job started (every 2 days at 02:00)");
}

module.exports = { runEventPriorityUpdate, start };
