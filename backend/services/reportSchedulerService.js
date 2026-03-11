const cron = require("node-cron");
const ReportSchedule = require("../models/ReportSchedule");
const reportService = require("./reportService");
const { sendEmailWithAttachment } = require("./emailService");

const activeJobs = new Map();

function getCronExpressionForFrequency(frequency) {
  switch (frequency) {
    case "daily":
      return "0 8 * * *";
    case "weekly":
      return "0 8 * * 1";
    case "monthly":
      return "0 8 1 * *";
    default:
      return null;
  }
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
    throw new Error(`Invalid recipient email: "${schedule.email}"`);
  }

  const { buffer, filename, contentType } = await generateReportBuffer(
    schedule.format,
    schedule.filters || {},
    schedule.userId,
  );

  await sendEmailWithAttachment({
    to: schedule.email,
    subject: "Scheduled Complaint Management Report",
    text: `Your ${schedule.frequency} complaint report is attached. Generated at ${new Date().toLocaleString()}.`,
    attachments: [{ filename, content: buffer, contentType }],
  });
}

async function executeSchedule(scheduleId) {
  const schedule = await ReportSchedule.findById(scheduleId);
  if (!schedule || !schedule.isActive) {
    return;
  }

  schedule.lastAttemptAt = new Date();
  try {
    await sendScheduledReport(schedule);
    schedule.lastSentAt = new Date();
    schedule.lastError = null;
  } catch (error) {
    schedule.lastError = error.message;
    console.error(`[report-scheduler] Schedule ${scheduleId} failed:`, error);
  }
  await schedule.save();
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
};
