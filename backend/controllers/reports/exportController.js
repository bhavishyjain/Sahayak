const reportService = require("../../services/reportService");
const Complaint = require("../../models/Complaint");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { buildFilters, getResolvedAt } = require("./helpers");

exports.generateExcelReport = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "query");
  const buffer = await reportService.generateExcelReport(filters, req.user._id);
  const filename = `complaints-report-${Date.now()}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

exports.generatePDFReport = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "query");
  const buffer = await reportService.generatePDFReport(filters, req.user._id);
  const filename = `complaints-report-${Date.now()}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

exports.generateCSVReport = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "query");
  const buffer = await reportService.generateCSVReport(filters, req.user._id);
  const filename = `complaints-report-${Date.now()}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

exports.getDashboardStats = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "query");
  let stats;
  if (typeof reportService.getDashboardStats === "function") {
    stats = await reportService.getDashboardStats(filters);
  } else {
    const complaints = await Complaint.find(filters).lean();

    let totalResolutionHours = 0;
    let resolvedCount = 0;
    stats = {
      total: complaints.length,
      byStatus: {},
      byPriority: {},
      byDepartment: {},
      avgResolutionTime: 0,
    };

    complaints.forEach((item) => {
      stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
      stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;
      stats.byDepartment[item.department] =
        (stats.byDepartment[item.department] || 0) + 1;

      const resolvedAt = getResolvedAt(item);
      if (resolvedAt && item.createdAt) {
        const hours =
          (resolvedAt.getTime() - new Date(item.createdAt).getTime()) /
          (1000 * 60 * 60);
        if (Number.isFinite(hours) && hours >= 0) {
          totalResolutionHours += hours;
          resolvedCount += 1;
        }
      }
    });

    stats.avgResolutionTime =
      resolvedCount > 0 ? Math.round(totalResolutionHours / resolvedCount) : 0;
  }

  sendSuccess(res, stats, "Dashboard statistics retrieved successfully");
});

exports.getDepartmentBreakdown = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "query");

  const complaints = await Complaint.find(filters).lean();

  const breakdown = {};
  complaints.forEach((item) => {
    const dept = item.department || "Other";
    if (!breakdown[dept]) {
      breakdown[dept] = {
        total: 0,
        pending: 0,
        inProgress: 0,
        resolved: 0,
        cancelled: 0,
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0,
      };
    }

    breakdown[dept].total++;

    if (item.status === "pending") breakdown[dept].pending++;
    else if (item.status === "in-progress") breakdown[dept].inProgress++;
    else if (item.status === "resolved") breakdown[dept].resolved++;
    else if (item.status === "cancelled") breakdown[dept].cancelled++;

    if (item.priority === "High") breakdown[dept].highPriority++;
    else if (item.priority === "Medium") breakdown[dept].mediumPriority++;
    else if (item.priority === "Low") breakdown[dept].lowPriority++;
  });

  sendSuccess(
    res,
    breakdown,
    "Department breakdown retrieved successfully",
  );
});
