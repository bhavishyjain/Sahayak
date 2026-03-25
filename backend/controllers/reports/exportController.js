const reportService = require("../../services/reportService");
const asyncHandler = require("../../core/asyncHandler");
const { sendSuccess } = require("../../core/response");
const { buildFilters } = require("./helpers");
const {
  serializeDepartmentBreakdown,
  serializeReportStats,
} = require("../../services/reportViewService");

function getExportTransport(req) {
  const queryTransport = String(req.query?.transport || "").trim().toLowerCase();
  if (queryTransport) return queryTransport;

  return String(req.get("x-report-transport") || "")
    .trim()
    .toLowerCase();
}

async function sendReportArtifact(req, res, { format, filename, contentType, buffer, filters }) {
  const safeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const { complaintCount } = await reportService.getReportMetadata(filters);

  console.info(
    `[reports] exported ${format} report complaints=${complaintCount} bytes=${safeBuffer.length}`,
  );

  if (getExportTransport(req) === "base64") {
    return sendSuccess(
      res,
      {
        filename,
        contentType,
        byteLength: safeBuffer.length,
        complaintCount,
        contentBase64: safeBuffer.toString("base64"),
      },
      "Report generated successfully",
    );
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(safeBuffer.length));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Report-Bytes", String(safeBuffer.length));
  res.setHeader("X-Report-Complaint-Count", String(complaintCount));
  return res.send(safeBuffer);
}

exports.generateExcelReport = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "query");
  const buffer = await reportService.generateExcelReport(filters, req.user._id);
  const filename = `complaints-report-${Date.now()}.xlsx`;
  await sendReportArtifact(req, res, {
    format: "excel",
    filename,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
    filters,
  });
});

exports.generatePDFReport = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "query");
  const buffer = await reportService.generatePDFReport(filters, req.user._id);
  const filename = `complaints-report-${Date.now()}.pdf`;
  await sendReportArtifact(req, res, {
    format: "pdf",
    filename,
    contentType: "application/pdf",
    buffer,
    filters,
  });
});

exports.generateCSVReport = asyncHandler(async (req, res) => {
  const filters = await buildFilters(req, "query");
  const buffer = await reportService.generateCSVReport(filters, req.user._id);
  const filename = `complaints-report-${Date.now()}.csv`;
  await sendReportArtifact(req, res, {
    format: "csv",
    filename,
    contentType: "text/csv; charset=utf-8",
    buffer,
    filters,
  });
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
