const ReportSchedule = require("../../models/ReportSchedule");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const AppError = require("../../core/AppError");
const emailService = require("../../services/emailService");
const {
  generateReportBuffer,
  registerScheduleJob,
  executeSchedule,
  isScheduleRunning,
} = require("../../services/reportSchedulerService");
const { buildFilters } = require("./helpers");
const {
  serializeReportSchedule,
  serializeReportScheduleList,
} = require("../../services/reportViewService");
const { emitRealtimeEvent } = require("../../services/realtimeService");
const {
  buildSchedulePolicy,
  buildActiveScheduleLookup,
  assertScheduleCanRunNow,
} = require("../../services/reportPolicyService");

exports.getSchedules = asyncHandler(async (req, res) => {
  const schedules = await ReportSchedule.find({
    userId: req.user._id,
    isActive: true,
  }).sort({ createdAt: -1 });

  sendSuccess(
    res,
    serializeReportScheduleList(schedules),
    "Schedules fetched successfully",
  );
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

  emitRealtimeEvent(
    "report-schedule-updated",
    {
      scheduleId: String(schedule._id),
      event: "schedule-cancelled",
      status: "inactive",
      schedule: serializeReportSchedule(schedule).item,
      updatedAt: new Date().toISOString(),
    },
    { userIds: [req.user._id] },
  );

  sendSuccess(
    res,
    serializeReportSchedule(schedule),
    "Schedule cancelled successfully",
  );
});

exports.runScheduleNow = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const schedule = await ReportSchedule.findOne({
    _id: id,
    userId: req.user._id,
    isActive: true,
  });

  assertScheduleCanRunNow(schedule, { isRunning: isScheduleRunning(id) });

  const updatedSchedule = await executeSchedule(schedule._id);

  sendSuccess(
    res,
    serializeReportSchedule(updatedSchedule),
    "Report schedule executed successfully",
  );
});

exports.scheduleEmailReport = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "body");
  const schedulePolicy = buildSchedulePolicy(req, filters);

  const scheduledReport = await ReportSchedule.findOneAndUpdate(
    buildActiveScheduleLookup({
      userId: req.user._id,
      email: schedulePolicy.email,
      frequency: schedulePolicy.frequency,
      format: schedulePolicy.format,
      department: schedulePolicy.department,
    }),
    {
      $set: {
        ...schedulePolicy,
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

  emitRealtimeEvent(
    "report-schedule-updated",
    {
      scheduleId: String(scheduledReport._id),
      event: "schedule-saved",
      status: scheduledReport.isActive ? "active" : "inactive",
      schedule: serializeReportSchedule(scheduledReport).item,
      updatedAt: new Date().toISOString(),
    },
    { userIds: [req.user._id] },
  );

  sendSuccess(
    res,
    serializeReportSchedule(scheduledReport),
    "Report scheduled successfully. You will receive reports via email.",
  );
});

exports.sendEmailReport = asyncHandler(async (req, res) => {
  const { email, format = "pdf" } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();

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
