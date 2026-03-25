const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Complaint = require("../models/Complaint");
const {
  normalizeStatus,
  getResolvedAt,
  escapeRegex,
} = require("../utils/normalize");
const {
  getComplaintDepartmentBreakdown,
  getComplaintMetricSnapshot,
  ANALYTICS_CONTRACT_VERSION,
} = require("./complaintAnalyticsService");

const REPORT_MAX_ROWS = Math.max(
  100,
  Number(process.env.REPORT_MAX_ROWS || 5000),
);
const PDF_MAX_ROWS = Math.min(
  REPORT_MAX_ROWS,
  Number(process.env.PDF_REPORT_MAX_ROWS || 1000),
);
const EXCEL_MAX_ROWS = Math.min(
  REPORT_MAX_ROWS,
  Number(process.env.EXCEL_REPORT_MAX_ROWS || 5000),
);
const CSV_MAX_ROWS = Math.min(
  REPORT_MAX_ROWS,
  Number(process.env.CSV_REPORT_MAX_ROWS || 5000),
);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const reportCache = new Map();
const REPORT_CACHE_TTL_MS = Math.max(
  5 * 1000,
  Number(process.env.REPORT_CACHE_TTL_MS || 60 * 1000),
);

function getCachedReportValue(cacheKey) {
  const entry = reportCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > REPORT_CACHE_TTL_MS) {
    reportCache.delete(cacheKey);
    return null;
  }
  return entry.value;
}

function setCachedReportValue(cacheKey, value) {
  reportCache.set(cacheKey, { value, createdAt: Date.now() });
  return value;
}

async function withCachedReportMetric(metricName, filters, factory) {
  const cacheKey = `${metricName}:${stableStringify(filters || {})}`;
  const cached = getCachedReportValue(cacheKey);
  if (cached) return cached;
  return setCachedReportValue(cacheKey, await factory());
}

function normalizeReportQuery(filters = {}) {
  const normalized = { ...(filters || {}) };

  if (
    typeof normalized.department === "string" &&
    normalized.department.trim()
  ) {
    normalized.department = new RegExp(
      `^${escapeRegex(normalized.department.trim())}$`,
      "i",
    );
  }

  return normalized;
}

function cleanText(value, maxLength = 240) {
  const text = String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function pdfSafe(value, maxLength = 200) {
  return cleanText(value, maxLength).replace(/[^\x20-\x7E]/g, "");
}

function formatDate(value) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-GB");
}

function calculateResponseTime(complaint) {
  if (!complaint?.assignedAt || !complaint?.createdAt) return "N/A";
  const diffMs =
    new Date(complaint.assignedAt).getTime() -
    new Date(complaint.createdAt).getTime();
  const hours = Math.round(diffMs / (1000 * 60 * 60));
  return hours > 0 ? String(hours) : "<1";
}

function buildAssignedWorkersLabel(complaint) {
  const assignments = Array.isArray(complaint?.assignedWorkers)
    ? complaint.assignedWorkers
    : [];
  if (assignments.length === 0) return "Unassigned";

  const names = assignments
    .map(
      (entry) => entry?.workerId?.fullName || entry?.workerId?.username || "",
    )
    .filter(Boolean);

  return names.length ? names.join(", ") : "Unassigned";
}

function getComplaintTitle(complaint) {
  const rawTitle = String(complaint?.refinedText || complaint?.rawText || "")
    .split(":")[0]
    .trim();
  return rawTitle || complaint?.ticketId || "Complaint";
}

function mapComplaintToRow(complaint) {
  const resolvedAt = getResolvedAt(complaint);
  return {
    ticketId: complaint?.ticketId || "N/A",
    title: cleanText(getComplaintTitle(complaint), 160),
    description: cleanText(
      complaint?.refinedText || complaint?.rawText || "No description",
      600,
    ),
    department: complaint?.department || "Other",
    priority: complaint?.priority || "Medium",
    status: normalizeStatus(complaint?.status) || "pending",
    location: cleanText(complaint?.locationName || "Not specified", 160),
    submittedBy: cleanText(
      complaint?.userId?.fullName || complaint?.userId?.username || "Unknown",
      120,
    ),
    assignedTo: cleanText(buildAssignedWorkersLabel(complaint), 200),
    createdAt: formatDate(complaint?.createdAt),
    resolvedAt: resolvedAt ? formatDate(resolvedAt) : "Pending",
    responseTime: calculateResponseTime(complaint),
    upvotes: Number(complaint?.upvoteCount || 0),
    rating: complaint?.feedback?.rating
      ? `${complaint.feedback.rating}/5`
      : "N/A",
  };
}

async function fetchReportRows(filters = {}, limit = REPORT_MAX_ROWS) {
  const query = normalizeReportQuery(filters);
  const complaints = await Complaint.find(query)
    .select(
      [
        "ticketId",
        "refinedText",
        "rawText",
        "department",
        "priority",
        "status",
        "locationName",
        "userId",
        "assignedWorkers",
        "assignedAt",
        "createdAt",
        "resolvedAt",
        "history.status",
        "history.timestamp",
        "upvoteCount",
        "feedback.rating",
      ].join(" "),
    )
    .populate("userId", "fullName username")
    .populate("assignedWorkers.workerId", "fullName username")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return complaints.map(mapComplaintToRow);
}

function toCsvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function departmentStats(rows) {
  return rows.reduce((acc, row) => {
    const key = row.department || "Other";
    if (!acc[key]) acc[key] = 0;
    acc[key] += 1;
    return acc;
  }, {});
}

function getPdfFontPaths() {
  const candidates = [
    {
      regular: path.resolve(__dirname, "../assets/fonts/FiraSans-Regular.ttf"),
      bold: path.resolve(__dirname, "../assets/fonts/FiraSans-Bold.ttf"),
    },
    {
      regular: path.resolve(
        __dirname,
        "../../mobile/assets/fonts/FiraSans-Regular.ttf",
      ),
      bold: path.resolve(
        __dirname,
        "../../mobile/assets/fonts/FiraSans-Bold.ttf",
      ),
    },
  ];

  return (
    candidates.find(
      (fontSet) =>
        fs.existsSync(fontSet.regular) && fs.existsSync(fontSet.bold),
    ) || null
  );
}

async function countComplaintsForReport(filters = {}) {
  return Complaint.countDocuments(normalizeReportQuery(filters));
}

class ReportService {
  async getDashboardStats(filters = {}) {
    return withCachedReportMetric("dashboard-stats", filters, async () => {
      const snapshot = await getComplaintMetricSnapshot(
        normalizeReportQuery(filters),
      );
      return {
        contractVersion: ANALYTICS_CONTRACT_VERSION,
        total: snapshot.total,
        byStatus: snapshot.byStatus,
        byPriority: snapshot.byPriority,
        byDepartment: snapshot.byDepartment,
        avgResolutionTime: snapshot.avgResolutionTime,
      };
    });
  }

  async getDepartmentBreakdown(filters = {}) {
    return withCachedReportMetric(
      "department-breakdown",
      filters,
      async () => ({
        contractVersion: ANALYTICS_CONTRACT_VERSION,
        ...(await getComplaintDepartmentBreakdown(
          normalizeReportQuery(filters),
        )),
      }),
    );
  }

  async generateExcelReport(filters = {}) {
    try {
      const rows = await fetchReportRows(filters, EXCEL_MAX_ROWS);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Sahayak";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("Complaints");
      sheet.columns = [
        { header: "Ticket ID", key: "ticketId", width: 18 },
        { header: "Title", key: "title", width: 34 },
        { header: "Description", key: "description", width: 52 },
        { header: "Department", key: "department", width: 18 },
        { header: "Priority", key: "priority", width: 12 },
        { header: "Status", key: "status", width: 14 },
        { header: "Location", key: "location", width: 24 },
        { header: "Submitted By", key: "submittedBy", width: 20 },
        { header: "Assigned To", key: "assignedTo", width: 24 },
        { header: "Created", key: "createdAt", width: 14 },
        { header: "Resolved", key: "resolvedAt", width: 14 },
        { header: "Response (hrs)", key: "responseTime", width: 14 },
        { header: "Upvotes", key: "upvotes", width: 10 },
        { header: "Rating", key: "rating", width: 10 },
      ];

      const header = sheet.getRow(1);
      header.font = { bold: true, color: { argb: "FFFFFFFF" } };
      header.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F4E78" },
      };

      if (rows.length) {
        sheet.addRows(rows);
      } else {
        sheet.addRow({
          ticketId: "No complaints found for selected filters",
        });
      }

      const summary = workbook.addWorksheet("Summary");
      summary.columns = [
        { header: "Metric", key: "metric", width: 30 },
        { header: "Value", key: "value", width: 20 },
      ];
      summary.getRow(1).font = { bold: true };
      summary.addRows([
        { metric: "Generated At", value: new Date().toLocaleString() },
        { metric: "Total Rows", value: rows.length },
      ]);

      Object.entries(departmentStats(rows)).forEach(([department, count]) => {
        summary.addRow({ metric: `Department: ${department}`, value: count });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    } catch (error) {
      console.error("Excel generation error:", error);
      throw new Error("Failed to generate Excel report");
    }
  }

  async generateCSVReport(filters = {}) {
    try {
      const rows = await fetchReportRows(filters, CSV_MAX_ROWS);
      const headers = [
        "Ticket ID",
        "Title",
        "Description",
        "Department",
        "Priority",
        "Status",
        "Location",
        "Submitted By",
        "Assigned To",
        "Created",
        "Resolved",
        "Response (hrs)",
        "Upvotes",
        "Rating",
      ];

      const lines = [headers.map(toCsvCell).join(",")];

      if (rows.length === 0) {
        lines.push(toCsvCell("No complaints found for selected filters"));
      } else {
        rows.forEach((row) => {
          lines.push(
            [
              row.ticketId,
              row.title,
              row.description,
              row.department,
              row.priority,
              row.status,
              row.location,
              row.submittedBy,
              row.assignedTo,
              row.createdAt,
              row.resolvedAt,
              row.responseTime,
              row.upvotes,
              row.rating,
            ]
              .map(toCsvCell)
              .join(","),
          );
        });
      }

      return Buffer.from(`\uFEFF${lines.join("\n")}\n`, "utf8");
    } catch (error) {
      console.error("CSV generation error:", error);
      throw new Error("Failed to generate CSV report");
    }
  }

  async generatePDFReport(filters = {}) {
    try {
      const rows = await fetchReportRows(filters, PDF_MAX_ROWS);
      const doc = new PDFDocument({ margin: 40, size: "A4", compress: false });
      const chunks = [];
      const customFonts = getPdfFontPaths();

      const regularFont = customFonts ? "ReportRegular" : "Helvetica";
      const boldFont = customFonts ? "ReportBold" : "Helvetica-Bold";

      if (customFonts) {
        doc.registerFont("ReportRegular", customFonts.regular);
        doc.registerFont("ReportBold", customFonts.bold);
      }

      const result = new Promise((resolve, reject) => {
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      doc.font(boldFont).fontSize(18).text("Complaint Management Report");
      doc.moveDown(0.25);
      doc
        .font(regularFont)
        .fontSize(10)
        .text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown(0.8);

      doc.font(boldFont).fontSize(12).text(`Total Complaints: ${rows.length}`);
      doc.moveDown(0.5);

      if (!rows.length) {
        doc
          .font(regularFont)
          .fontSize(11)
          .text("No complaints found for selected filters.");
      } else {
        rows.forEach((row, index) => {
          if (doc.y > 760) doc.addPage();

          doc
            .font(boldFont)
            .fontSize(10)
            .text(
              `${index + 1}. ${pdfSafe(row.ticketId, 40)} - ${pdfSafe(row.title, 90)}`,
            );

          doc.font(regularFont).fontSize(9);
          doc.text(
            `Dept: ${pdfSafe(row.department, 25)} | Status: ${pdfSafe(row.status, 20)} | Priority: ${pdfSafe(row.priority, 15)}`,
          );
          doc.text(`Location: ${pdfSafe(row.location, 90)}`);
          doc.text(
            `Submitted: ${pdfSafe(row.submittedBy, 35)} | Assigned: ${pdfSafe(row.assignedTo, 55)}`,
          );
          doc.text(
            `Created: ${pdfSafe(row.createdAt, 20)} | Resolved: ${pdfSafe(row.resolvedAt, 20)}`,
          );
          doc.moveDown(0.6);
        });
      }

      doc.end();
      return result;
    } catch (error) {
      console.error("PDF generation error:", error);
      throw new Error("Failed to generate PDF report");
    }
  }

  async getReportMetadata(filters = {}) {
    return { complaintCount: await countComplaintsForReport(filters) };
  }
}

module.exports = new ReportService();
