const ReportSchedule = require("../../models/ReportSchedule");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const AppError = require("../../core/AppError");
const emailService = require("../../services/emailService");
const {
  getCronExpressionForFrequency,
  generateReportBuffer,
  registerScheduleJob,
} = require("../../services/reportSchedulerService");
const { normalizeString, buildFilters } = require("./helpers");

exports.getSchedules = asyncHandler(async (req, res) => {
  const schedules = await ReportSchedule.find({
    userId: req.user._id,
    isActive: true,
  }).sort({ createdAt: -1 });

  sendSuccess(res, { schedules }, "Schedules fetched successfully");
});

exports.cancelSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schedule = await ReportSchedule.findOneAndUpdate(
    { _id: id, userId: req.user._id },
    { $set: { isActive: false } },
    { new: true },
  );

  if (!schedule) {
    throw new AppError("Schedule not found", 404);
  }

  sendSuccess(res, { schedule }, "Schedule cancelled successfully");
});

exports.scheduleEmailReport = asyncHandler(async (req, res) => {
  const { email, frequency, department, format = "pdf" } = req.body;
  const normalizedEmail = normalizeString(email).toLowerCase();
  if (!normalizedEmail) {
    throw new AppError("Email is required", 400);
  }

  if (!["daily", "weekly", "monthly"].includes(frequency)) {
    throw new AppError(
      "Invalid frequency. Use: daily, weekly, or monthly",
      400,
    );
  }

  if (!["pdf", "excel", "csv"].includes(format)) {
    throw new AppError("Invalid format. Use: pdf, excel, or csv", 400);
  }

  const filters = await buildFilters(req, "body");
  if (department && req.user?.role === "admin" && department !== "all") {
    filters.department = department;
  }
  const cronExpression = getCronExpressionForFrequency(frequency);
  if (!cronExpression) {
    throw new AppError("Invalid schedule frequency", 400);
  }
  const departmentFilter = normalizeString(filters.department) || "all";

  const scheduledReport = await ReportSchedule.findOneAndUpdate(
    {
      userId: req.user._id,
      email: normalizedEmail,
      frequency,
      format,
      department: departmentFilter,
      isActive: true,
    },
    {
      $set: {
        email: normalizedEmail,
        frequency,
        format,
        department: departmentFilter,
        filters,
        cronExpression,
        timezone: process.env.REPORT_SCHEDULE_TIMEZONE || "Asia/Kolkata",
        isActive: true,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
  registerScheduleJob(scheduledReport);

  sendSuccess(
    res,
    scheduledReport,
    "Report scheduled successfully. You will receive reports via email.",
  );
});

exports.sendEmailReport = asyncHandler(async (req, res) => {
  const { email, format = "pdf" } = req.body;
  const normalizedEmail = normalizeString(email).toLowerCase();

  if (!normalizedEmail) {
    throw new AppError("Email is required", 400);
  }

  const filters = await buildFilters(req, "body");
  const { buffer, filename, contentType } = await generateReportBuffer(
    format,
    filters,
    req.user._id,
  );

  try {
    await emailService.sendEmailWithAttachment({
      to: normalizedEmail,
      subject: "Complaint Management Report",
      text: `Please find attached the complaint management report generated on ${new Date().toLocaleString()}.`,
      attachments: [
        {
          filename,
          content: buffer,
          contentType,
        },
      ],
    });

    sendSuccess(
      res,
      { email: normalizedEmail, filename },
      "Report sent to email successfully",
    );
  } catch (error) {
    console.error("Email sending error:", error);
    throw new AppError(
      "Failed to send email. Email service may not be configured.",
      500,
    );
  }
});
