const cron = require("node-cron");
const ReportSchedule = require("../models/ReportSchedule");
const reportService = require("./reportService");
const { sendEmailWithAttachment } = require("./emailService");
const {
  getCronExpressionForFrequency,
} = require("./reportPolicyService");
const { emitRealtimeEvent } = require("./realtimeService");

const activeJobs = new Map();
const runningSchedules = new Set();

function formatScheduleDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function resolveDynamicScheduleFilters(filters = {}) {
  const rangePreset = String(filters?.rangePreset || "").trim();
  if (!rangePreset || rangePreset === "custom") {
    return { ...(filters || {}) };
  }

  const now = new Date();
  const start = new Date(now);
  if (rangePreset === "24h") {
    start.setDate(start.getDate() - 1);
  } else if (rangePreset === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (rangePreset === "30d") {
    start.setDate(start.getDate() - 30);
  } else {
    return { ...(filters || {}) };
  }

  return {
    ...(filters || {}),
    startDate: formatScheduleDate(start),
    endDate: formatScheduleDate(now),
  };
}

async function generateReportBuffer(format, filters, userId) {
  switch (format) {
    case "excel":
      return {
        buffer: await reportService.generateExcelReport(filters, userId),
        filename: `complaints-report-${Date.now()}.xlsx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    case "csv":
      return {
        buffer: await reportService.generateCSVReport(filters, userId),
        filename: `complaints-report-${Date.now()}.csv`,
        contentType: "text/csv",
      };
    case "pdf":
    default:
      return {
        buffer: await reportService.generatePDFReport(filters, userId),
        filename: `complaints-report-${Date.now()}.pdf`,
        contentType: "application/pdf",
      };
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendScheduledReport(schedule) {
  if (!schedule.email || !EMAIL_RE.test(schedule.email)) {
    const error = new Error(`Invalid recipient email: "${schedule.email}"`);
    error.stage = "delivery";
    throw error;
  }

  let reportArtifact;
  try {
    reportArtifact = await generateReportBuffer(
      schedule.format,
      resolveDynamicScheduleFilters(schedule.filters || {}),
      schedule.userId,
    );
  } catch (error) {
    error.stage = error.stage || "generation";
    throw error;
  }

  const { buffer, filename, contentType } = reportArtifact;

  try {
    await sendEmailWithAttachment({
      to: schedule.email,
      subject: "Scheduled Complaint Management Report",
      text: `Your ${schedule.frequency} complaint report is attached. Generated at ${new Date().toLocaleString("en-IN", { timeZone: schedule.timezone || "Asia/Kolkata" })}.`,
      attachments: [{ filename, content: buffer, contentType }],
    });
  } catch (error) {
    error.stage = error.stage || "delivery";
    throw error;
  }
}

function getTimeZoneDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: parts.weekday,
  };
}

function getTimeZoneOffsetMillis(date, timeZone) {
  const parts = getTimeZoneDateParts(date, timeZone);
  const utcTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return utcTimestamp - date.getTime();
}

function zonedDateTimeToUtc(
  { year, month, day, hour = 0, minute = 0, second = 0 },
  timeZone,
) {
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );
  const offset = getTimeZoneOffsetMillis(utcGuess, timeZone);
  const resolved = new Date(utcGuess.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMillis(resolved, timeZone);
  return new Date(utcGuess.getTime() - correctedOffset);
}

function addDays(parts, daysToAdd) {
  const next = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + daysToAdd, 12, 0, 0),
  );
  return getTimeZoneDateParts(next, "UTC");
}

function getNextRunAt(schedule, now = new Date()) {
  const timeZone = schedule?.timezone || "Asia/Kolkata";
  const localNow = getTimeZoneDateParts(now, timeZone);
  const targetHour = Math.max(0, Math.min(23, Number(schedule?.hour) || 9));
  const weekdayMap = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  let target = {
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
    hour: targetHour,
    minute: 0,
    second: 0,
  };

  const hasPassedToday =
    localNow.hour > targetHour ||
    (localNow.hour === targetHour && localNow.minute > 0) ||
    (localNow.hour === targetHour &&
      localNow.minute === 0 &&
      localNow.second > 0);

  if (schedule?.frequency === "weekly") {
    const currentWeekday = weekdayMap[localNow.weekday] ?? 0;
    let daysUntilNext = (1 - currentWeekday + 7) % 7;
    if (daysUntilNext === 0 && hasPassedToday) {
      daysUntilNext = 7;
    }
    const nextDate = addDays(localNow, daysUntilNext);
    target = {
      ...target,
      year: nextDate.year,
      month: nextDate.month,
      day: nextDate.day,
    };
  } else if (schedule?.frequency === "monthly") {
    const todayIsFirst = localNow.day === 1;
    const shouldMoveToNextMonth = !todayIsFirst || hasPassedToday;
    if (shouldMoveToNextMonth) {
      const nextMonthDate = new Date(
        Date.UTC(localNow.year, localNow.month, 1, 12, 0, 0),
      );
      const nextMonthParts = getTimeZoneDateParts(nextMonthDate, "UTC");
      target = {
        ...target,
        year: nextMonthParts.year,
        month: nextMonthParts.month,
        day: 1,
      };
    } else {
      target.day = 1;
    }
  } else if (hasPassedToday) {
    const nextDate = addDays(localNow, 1);
    target = {
      ...target,
      year: nextDate.year,
      month: nextDate.month,
      day: nextDate.day,
    };
  }

  return zonedDateTimeToUtc(target, timeZone);
}

function serializeScheduleHealth(schedule) {
  const plain =
    typeof schedule?.toObject === "function" ? schedule.toObject() : schedule;
  const nextRunAt = plain?.isActive ? getNextRunAt(plain) : null;
  const lastRunStatus = plain?.lastError
    ? "failed"
    : plain?.lastSentAt
      ? "success"
      : plain?.lastAttemptAt
        ? "pending"
        : "idle";

  return {
    ...plain,
    nextRunAt,
    lastRunStatus,
    health: {
      nextRunAt,
      lastRunStatus,
      lastSuccessAt: plain?.lastSentAt || null,
      lastFailureAt: plain?.lastFailureAt || null,
      lastError: plain?.lastError || null,
      lastErrorStage: plain?.lastErrorStage || null,
      lastAttemptAt: plain?.lastAttemptAt || null,
    },
  };
}

async function executeSchedule(scheduleId) {
  const normalizedScheduleId = String(scheduleId || "");
  if (!normalizedScheduleId) {
    return null;
  }
  if (runningSchedules.has(normalizedScheduleId)) {
    const error = new Error("Schedule is already running");
    error.code = "SCHEDULE_RUNNING";
    throw error;
  }

  runningSchedules.add(normalizedScheduleId);
  try {
    const schedule = await ReportSchedule.findById(scheduleId);
    if (!schedule || !schedule.isActive) {
      return null;
    }

    emitRealtimeEvent(
      "report-schedule-updated",
      {
        scheduleId: String(schedule._id),
        event: "schedule-run-started",
        status: "running",
        updatedAt: new Date().toISOString(),
      },
      { userIds: [schedule.userId] },
    );

    schedule.lastAttemptAt = new Date();
    try {
      await sendScheduledReport(schedule);
      schedule.lastSentAt = new Date();
      schedule.lastFailureAt = null;
      schedule.lastError = null;
      schedule.lastErrorStage = null;
    } catch (error) {
      schedule.lastFailureAt = new Date();
      schedule.lastError = error.message;
      schedule.lastErrorStage = error.stage || "delivery";
      console.error(`[report-scheduler] Schedule ${scheduleId} failed:`, error);
    }
    await schedule.save();
    const serialized = serializeScheduleHealth(schedule);
    emitRealtimeEvent(
      "report-schedule-updated",
      {
        scheduleId: String(schedule._id),
        event: schedule.lastError ? "schedule-run-failed" : "schedule-run-succeeded",
        status: schedule.lastError ? "failed" : "success",
        schedule: serialized,
        updatedAt: new Date().toISOString(),
      },
      { userIds: [schedule.userId] },
    );
    return serialized;
  } finally {
    runningSchedules.delete(normalizedScheduleId);
  }
}

function stopScheduleJob(scheduleId) {
  const existing = activeJobs.get(String(scheduleId));
  if (existing) {
    existing.stop();
    activeJobs.delete(String(scheduleId));
  }
}

function registerScheduleJob(schedule) {
  stopScheduleJob(schedule._id);

  if (!schedule.isActive) {
    return;
  }

  const task = cron.schedule(
    schedule.cronExpression,
    async () => {
      await executeSchedule(schedule._id);
    },
    {
      timezone: schedule.timezone || "Asia/Kolkata",
    },
  );
  activeJobs.set(String(schedule._id), task);
}

async function initializeReportSchedulers() {
  const schedules = await ReportSchedule.find({ isActive: true });
  for (const schedule of schedules) {
    registerScheduleJob(schedule);
  }
  console.log(`[report-scheduler] Initialized ${schedules.length} schedules`);
}

module.exports = {
  getCronExpressionForFrequency,
  generateReportBuffer,
  registerScheduleJob,
  initializeReportSchedulers,
  executeSchedule,
  isScheduleRunning: (scheduleId) => runningSchedules.has(String(scheduleId || "")),
  getNextRunAt,
  serializeScheduleHealth,
};
