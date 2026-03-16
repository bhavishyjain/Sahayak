const reportService = require("../../services/reportService");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { buildFilters } = require("./helpers");
const {
  serializeDepartmentBreakdown,
  serializeReportStats,
} = require("../../services/reportViewService");

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
  const stats = await reportService.getDashboardStats(filters);

  sendSuccess(
    res,
    serializeReportStats(stats),
    "Dashboard statistics retrieved successfully",
  );
});

exports.getDepartmentBreakdown = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "query");
  const breakdown = await reportService.getDepartmentBreakdown(filters);

  sendSuccess(
    res,
    serializeDepartmentBreakdown(breakdown),
    "Department breakdown retrieved successfully",
  );
});
