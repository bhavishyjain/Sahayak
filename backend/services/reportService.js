const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
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
  Number(process.env.PDF_REPORT_MAX_ROWS || 1500),
);
const EXCEL_MAX_ROWS = Math.min(
  REPORT_MAX_ROWS,
  Number(process.env.EXCEL_REPORT_MAX_ROWS || 5000),
);
const CSV_MAX_ROWS = Math.min(
  REPORT_MAX_ROWS,
  Number(process.env.CSV_REPORT_MAX_ROWS || 5000),
);
const REPORT_CACHE_TTL_MS = Math.max(
  5 * 1000,
  Number(process.env.REPORT_CACHE_TTL_MS || 60 * 1000),
);
const reportCache = new Map();

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

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
  reportCache.set(cacheKey, {
    value,
    createdAt: Date.now(),
  });
  return value;
}

async function withCachedReportMetric(metricName, filters, factory) {
  const cacheKey = `${metricName}:${stableStringify(filters || {})}`;
  const cached = getCachedReportValue(cacheKey);
  if (cached) return cached;

  const startedAt = Date.now();
  const value = await factory();
  const durationMs = Date.now() - startedAt;
  console.info(`[reports] ${metricName} generated in ${durationMs}ms`);
  return setCachedReportValue(cacheKey, value);
}

function normalizeReportQuery(filters = {}) {
  const normalizedFilters = { ...(filters || {}) };

  if (
    typeof normalizedFilters.department === "string" &&
    normalizedFilters.department.trim()
  ) {
    normalizedFilters.department = new RegExp(
      `^${escapeRegex(normalizedFilters.department.trim())}$`,
      "i",
    );
  }

  return normalizedFilters;
}

async function fetchComplaintsForReport(filters, limit) {
  const normalizedFilters = normalizeReportQuery(filters);
  return Complaint.find(normalizedFilters)
    .populate("userId", "fullName username")
    .populate("assignedWorkers.workerId", "fullName username")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

async function countComplaintsForReport(filters = {}) {
  const normalizedFilters = normalizeReportQuery(filters);
  return Complaint.countDocuments(normalizedFilters);
}

function getComplaintTitle(complaint) {
  const rawTitle = String(complaint?.refinedText || complaint?.rawText || "")
    .split(":")[0]
    .trim();
  return rawTitle || complaint?.ticketId || "Complaint";
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
  return hours > 0 ? hours : "<1";
}

function buildAssignedWorkersLabel(complaint) {
  const assignments = Array.isArray(complaint?.assignedWorkers)
    ? complaint.assignedWorkers
    : [];
  if (assignments.length === 0) return "Unassigned";

  const names = assignments
    .map(
      (assignment) =>
        assignment?.workerId?.fullName || assignment?.workerId?.username || "",
    )
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "Unassigned";
}

function mapComplaintToReportRow(complaint) {
  const resolvedAt = getResolvedAt(complaint);
  const normalizedComplaintStatus = normalizeStatus(complaint?.status);

  return {
    ticketId: complaint?.ticketId || "N/A",
    title: getComplaintTitle(complaint),
    description: complaint?.refinedText || complaint?.rawText || "No description",
    department: complaint?.department || "Other",
    priority: complaint?.priority || "Medium",
    status: normalizedComplaintStatus || "pending",
    location: complaint?.locationName || "Not specified",
    submittedBy:
      complaint?.userId?.fullName || complaint?.userId?.username || "Unknown",
    assignedTo: buildAssignedWorkersLabel(complaint),
    createdAt: formatDate(complaint?.createdAt),
    resolvedAt: resolvedAt ? formatDate(resolvedAt) : "Pending",
    responseTime: calculateResponseTime(complaint),
    upvotes: Number(complaint?.upvoteCount || 0),
    rating: complaint?.feedback?.rating
      ? `${complaint.feedback.rating}/5`
      : "N/A",
  };
}

function buildDepartmentStats(rows) {
  return rows.reduce((acc, row) => {
    const department = row.department || "Other";
    if (!acc[department]) {
      acc[department] = { total: 0, resolved: 0, pending: 0, inProgress: 0 };
    }
    acc[department].total += 1;
    if (row.status === "resolved") acc[department].resolved += 1;
    else if (row.status === "pending") acc[department].pending += 1;
    else if (row.status === "in-progress") acc[department].inProgress += 1;
    return acc;
  }, {});
}

function calculateAverageResponseTime(rows) {
  const numericHours = rows
    .map((row) => {
      if (row.responseTime === "N/A" || row.responseTime === "<1") {
        return row.responseTime === "<1" ? 1 : null;
      }
      const parsed = Number(row.responseTime);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value) => value !== null);

  if (numericHours.length === 0) return "N/A";
  return Math.round(
    numericHours.reduce((sum, value) => sum + value, 0) / numericHours.length,
  );
}

async function getReportRows(filters = {}, limit = REPORT_MAX_ROWS) {
  const complaints = await fetchComplaintsForReport(filters, limit);
  return complaints.map(mapComplaintToReportRow);
}

function toCsvCell(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
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
        ...(
          await getComplaintDepartmentBreakdown(
            normalizeReportQuery(filters),
          )
        ),
      }),
    );
  }

  async generateExcelReport(filters = {}) {
    try {
      const rows = await getReportRows(filters, EXCEL_MAX_ROWS);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Sahayak Municipal System";
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet("Complaints Report");
      worksheet.columns = [
        { header: "Ticket ID", key: "ticketId", width: 18 },
        { header: "Title", key: "title", width: 34 },
        { header: "Department", key: "department", width: 18 },
        { header: "Priority", key: "priority", width: 12 },
        { header: "Status", key: "status", width: 18 },
        { header: "Location", key: "location", width: 28 },
        { header: "Submitted By", key: "submittedBy", width: 22 },
        { header: "Assigned To", key: "assignedTo", width: 28 },
        { header: "Created Date", key: "createdAt", width: 16 },
        { header: "Resolved Date", key: "resolvedAt", width: 16 },
        { header: "Response Time (hrs)", key: "responseTime", width: 18 },
        { header: "Upvotes", key: "upvotes", width: 12 },
        { header: "Rating", key: "rating", width: 12 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F766E" },
      };
      headerRow.alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      headerRow.height = 22;

      rows.forEach((row, index) => {
        const worksheetRow = worksheet.addRow(row);

        if (index % 2 === 1) {
          worksheetRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }

        const statusCell = worksheetRow.getCell("status");
        if (row.status === "resolved") {
          statusCell.font = { color: { argb: "FF059669" }, bold: true };
        } else if (row.status === "in-progress") {
          statusCell.font = { color: { argb: "FF2563EB" }, bold: true };
        } else if (row.status === "pending") {
          statusCell.font = { color: { argb: "FFD97706" }, bold: true };
        }
      });

      await this.addSummarySheet(workbook, rows);
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    } catch (error) {
      console.error("Excel generation error:", error);
      throw new Error("Failed to generate Excel report");
    }
  }

  async addSummarySheet(workbook, rows) {
    const summarySheet = workbook.addWorksheet("Summary");
    const total = rows.length;
    const resolved = rows.filter((row) => row.status === "resolved").length;
    const pending = rows.filter((row) => row.status === "pending").length;
    const inProgress = rows.filter((row) => row.status === "in-progress").length;
    const cancelled = rows.filter((row) => row.status === "cancelled").length;

    summarySheet.mergeCells("A1:B1");
    summarySheet.getCell("A1").value = "Complaint Report Summary";
    summarySheet.getCell("A1").font = { bold: true, size: 16 };
    summarySheet.getCell("A1").alignment = { horizontal: "center" };

    summarySheet.getCell("A2").value = "Generated On";
    summarySheet.getCell("B2").value = new Date().toLocaleString();
    summarySheet.addRow([]);
    summarySheet.addRow(["Overall Statistics", ""]);
    summarySheet.addRow(["Total Complaints", total]);
    summarySheet.addRow(["Resolved", resolved]);
    summarySheet.addRow(["In Progress", inProgress]);
    summarySheet.addRow(["Pending", pending]);
    summarySheet.addRow(["Cancelled", cancelled]);
    summarySheet.addRow([
      "Average Response Time (hrs)",
      calculateAverageResponseTime(rows),
    ]);
    summarySheet.addRow([
      "Resolution Rate",
      `${total > 0 ? ((resolved / total) * 100).toFixed(1) : 0}%`,
    ]);

    summarySheet.addRow([]);
    summarySheet.addRow(["Department Breakdown", "Count"]);
    Object.entries(buildDepartmentStats(rows))
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([department, stats]) => {
        summarySheet.addRow([department, stats.total]);
      });

    summarySheet.addRow([]);
    summarySheet.addRow(["Priority Breakdown", "Count"]);
    ["High", "Medium", "Low"].forEach((priority) => {
      summarySheet.addRow([
        priority,
        rows.filter((row) => row.priority === priority).length,
      ]);
    });

    summarySheet.getColumn("A").width = 28;
    summarySheet.getColumn("B").width = 18;
    summarySheet.getColumn("A").font = { bold: true };
  }

  async generatePDFReport(filters = {}) {
    try {
      const rows = await getReportRows(filters, PDF_MAX_ROWS);
      const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
      const chunks = [];

      const bufferReady = new Promise((resolve, reject) => {
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      const total = rows.length;
      const resolved = rows.filter((row) => row.status === "resolved").length;
      const pending = rows.filter((row) => row.status === "pending").length;
      const inProgress = rows.filter((row) => row.status === "in-progress").length;

      doc
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("Complaint Management Report", { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`Generated on ${new Date().toLocaleString()}`, { align: "center" });
      doc.moveDown(1);

      doc.fontSize(15).font("Helvetica-Bold").text("Executive Summary");
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica");
      doc.text(`Total Complaints: ${total}`);
      doc.text(`Resolved: ${resolved}`);
      doc.text(`In Progress: ${inProgress}`);
      doc.text(`Pending: ${pending}`);
      doc.text(`Average Response Time: ${calculateAverageResponseTime(rows)} hours`);
      doc.moveDown(1);

      doc.fontSize(14).font("Helvetica-Bold").text("Department Breakdown");
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      Object.entries(buildDepartmentStats(rows))
        .sort((a, b) => b[1].total - a[1].total)
        .forEach(([department, stats]) => {
          doc
            .fontSize(10)
            .font("Helvetica")
            .text(
              `${department}: ${stats.total} complaints (${stats.resolved} resolved, ${stats.pending} pending, ${stats.inProgress} in progress)`,
            );
        });

      if (rows.length > 0) {
        doc.addPage();
        doc.fontSize(14).font("Helvetica-Bold").text("Recent Complaints");
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
        rows.forEach((row, index) => {
          if (doc.y > 700) {
            doc.addPage();
          }
          doc.fontSize(10).font("Helvetica-Bold").text(
            `${index + 1}. ${row.ticketId} - ${row.title}`,
          );
          doc.fontSize(9).font("Helvetica");
          doc.text(
            `Status: ${row.status} | Priority: ${row.priority} | Department: ${row.department}`,
          );
          doc.text(`Location: ${row.location}`);
          doc.text(`Submitted By: ${row.submittedBy} | Assigned To: ${row.assignedTo}`);
          doc.text(`Created: ${row.createdAt} | Resolved: ${row.resolvedAt}`);
          doc.moveDown(0.5);
        });
      }

      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i += 1) {
        doc.switchToPage(pages.start + i);
        doc
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Page ${i + 1} of ${pages.count}`,
            50,
            doc.page.height - 40,
            { align: "center", width: doc.page.width - 100 },
          );
      }

      doc.end();
      return bufferReady;
    } catch (error) {
      console.error("PDF generation error:", error);
      throw new Error("Failed to generate PDF report");
    }
  }

  async generateCSVReport(filters = {}) {
    try {
      const rows = await getReportRows(filters, CSV_MAX_ROWS);
      const csvRows = [
        [
          "Ticket ID",
          "Title",
          "Department",
          "Priority",
          "Status",
          "Location",
          "Submitted By",
          "Assigned To",
          "Created Date",
          "Resolved Date",
          "Response Time (hrs)",
          "Upvotes",
          "Rating",
        ],
        ...rows.map((row) => [
          row.ticketId,
          row.title,
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
        ]),
      ];

      const csvString = `\uFEFF${csvRows
        .map((row) => row.map((cell) => toCsvCell(cell)).join(","))
        .join("\n")}\n`;
      return Buffer.from(csvString, "utf-8");
    } catch (error) {
      console.error("CSV generation error:", error);
      throw new Error("Failed to generate CSV report");
    }
  }

  async getReportMetadata(filters = {}) {
    const complaintCount = await countComplaintsForReport(filters);
    return { complaintCount };
  }
}

module.exports = new ReportService();
