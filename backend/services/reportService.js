const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const Complaint = require("../models/Complaint");
const { normalizeStatus, getResolvedAt } = require("../utils/normalize");

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

function toCsvCell(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
}

async function fetchComplaintsForReport(filters, limit) {
  return Complaint.find(filters)
    .populate("userId", "fullName username")
    .populate("assignedWorkers.workerId", "fullName username")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

class ReportService {
  // Generate Excel Report
  async generateExcelReport(filters = {}, userId) {
    try {
      const workbook = new ExcelJS.Workbook();

      // Set workbook properties
      workbook.creator = "Sahayak Municipal System";
      workbook.created = new Date();
      workbook.modified = new Date();

      // Main Complaints Sheet
      const worksheet = workbook.addWorksheet("Complaints Report");

      // Define columns
      worksheet.columns = [
        { header: "Ticket ID", key: "ticketId", width: 15 },
        { header: "Title", key: "title", width: 35 },
        { header: "Department", key: "department", width: 15 },
        { header: "Priority", key: "priority", width: 10 },
        { header: "Status", key: "status", width: 15 },
        { header: "Location", key: "location", width: 30 },
        { header: "Submitted By", key: "submittedBy", width: 20 },
        { header: "Assigned To", key: "assignedTo", width: 20 },
        { header: "Created Date", key: "createdAt", width: 15 },
        { header: "Resolved Date", key: "resolvedAt", width: 15 },
        { header: "Response Time (hrs)", key: "responseTime", width: 18 },
        { header: "Upvotes", key: "upvotes", width: 10 },
        { header: "Rating", key: "rating", width: 10 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      worksheet.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      worksheet.getRow(1).height = 25;

      // Fetch complaints data
      const complaints = await fetchComplaintsForReport(
        filters,
        EXCEL_MAX_ROWS,
      );

      // Add data rows
      complaints.forEach((complaint, index) => {
        const resolvedAt = getResolvedAt(complaint);
        const row = worksheet.addRow({
          ticketId: complaint.ticketId || "N/A",
          title: complaint.refinedText || complaint.rawText || "No title",
          department: complaint.department || "N/A",
          priority: complaint.priority || "Medium",
          status: complaint.status || "pending",
          location: complaint.locationName || "Not specified",
          submittedBy:
            complaint.userId?.fullName ||
            complaint.userId?.username ||
            "Unknown",
          assignedTo:
            complaint.assignedWorkers?.[0]?.workerId?.fullName ||
            complaint.assignedWorkers?.[0]?.workerId?.username ||
            "Unassigned",
          createdAt: complaint.createdAt
            ? new Date(complaint.createdAt).toLocaleDateString("en-GB")
            : "N/A",
          resolvedAt: resolvedAt
            ? resolvedAt.toLocaleDateString("en-GB")
            : "Pending",
          responseTime: this.calculateResponseTime(complaint),
          upvotes: complaint.upvoteCount || 0,
          rating: complaint.feedback?.rating
            ? `${complaint.feedback.rating}/5`
            : "N/A",
        });

        // Alternate row colors
        if (index % 2 === 1) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          };
        }

        // Color code by status
        const statusCell = row.getCell("status");
        switch (normalizeStatus(complaint.status)) {
          case "resolved":
            statusCell.font = { color: { argb: "FF10B981" }, bold: true };
            break;
          case "in-progress":
            statusCell.font = { color: { argb: "FF3B82F6" }, bold: true };
            break;
          case "pending":
            statusCell.font = { color: { argb: "FFF59E0B" }, bold: true };
            break;
        }

        // Color code by priority
        const priorityCell = row.getCell("priority");
        switch (complaint.priority?.toLowerCase()) {
          case "high":
            priorityCell.font = { color: { argb: "FFEF4444" }, bold: true };
            break;
          case "medium":
            priorityCell.font = { color: { argb: "FFF59E0B" } };
            break;
          case "low":
            priorityCell.font = { color: { argb: "FF10B981" } };
            break;
        }
      });

      // Add Summary Sheet
      await this.addSummarySheet(workbook, complaints, filters);

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      console.error("Excel generation error:", error);
      throw new Error("Failed to generate Excel report");
    }
  }

  // Add Summary Sheet to workbook
  async addSummarySheet(workbook, complaints, filters) {
    const summarySheet = workbook.addWorksheet("Summary");

    // Title
    summarySheet.mergeCells("A1:B1");
    summarySheet.getCell("A1").value = "Complaint Report Summary";
    summarySheet.getCell("A1").font = { bold: true, size: 16 };
    summarySheet.getCell("A1").alignment = { horizontal: "center" };

    // Date range
    summarySheet.getCell("A2").value = "Report Generated:";
    summarySheet.getCell("B2").value = new Date().toLocaleString();

    summarySheet.addRow([]);

    // Overall Statistics
    const total = complaints.length;
    const resolved = complaints.filter(
      (c) => normalizeStatus(c.status) === "resolved",
    ).length;
    const pending = complaints.filter(
      (c) => normalizeStatus(c.status) === "pending",
    ).length;
    const inProgress = complaints.filter(
      (c) => normalizeStatus(c.status) === "in-progress",
    ).length;
    const cancelled = complaints.filter(
      (c) => normalizeStatus(c.status) === "cancelled",
    ).length;

    summarySheet.addRow(["Overall Statistics", ""]);
    summarySheet.addRow(["Total Complaints", total]);
    summarySheet.addRow(["Resolved", resolved]);
    summarySheet.addRow(["In Progress", inProgress]);
    summarySheet.addRow(["Pending", pending]);
    summarySheet.addRow(["Cancelled", cancelled]);
    summarySheet.addRow([
      "Resolution Rate",
      `${total > 0 ? ((resolved / total) * 100).toFixed(1) : 0}%`,
    ]);

    summarySheet.addRow([]);

    // Department-wise breakdown
    summarySheet.addRow(["Department Breakdown", "Count"]);
    const deptStats = {};
    complaints.forEach((c) => {
      const dept = c.department || "Other";
      deptStats[dept] = (deptStats[dept] || 0) + 1;
    });

    Object.entries(deptStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([dept, count]) => {
        summarySheet.addRow([dept, count]);
      });

    summarySheet.addRow([]);

    // Priority breakdown
    summarySheet.addRow(["Priority Breakdown", "Count"]);
    const highPriority = complaints.filter((c) => c.priority === "High").length;
    const mediumPriority = complaints.filter(
      (c) => c.priority === "Medium",
    ).length;
    const lowPriority = complaints.filter((c) => c.priority === "Low").length;

    summarySheet.addRow(["High", highPriority]);
    summarySheet.addRow(["Medium", mediumPriority]);
    summarySheet.addRow(["Low", lowPriority]);

    // Style column A
    summarySheet.getColumn("A").font = { bold: true };
    summarySheet.getColumn("A").width = 25;
    summarySheet.getColumn("B").width = 15;
  }

  // Generate PDF Report
  async generatePDFReport(filters = {}, userId) {
    // Fetch data before touching the PDF stream so async errors propagate naturally
    const complaints = await fetchComplaintsForReport(filters, PDF_MAX_ROWS);

    const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
    const buffers = [];
    // Wrap stream events in a clean Promise (no async executor)
    const bufferReady = new Promise((resolve, reject) => {
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);
    });

    // Header
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Complaint Management Report", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Generated on: ${new Date().toLocaleString()}`, {
        align: "center",
      });
    doc.moveDown(1);

    // Summary Section
    doc.fontSize(16).font("Helvetica-Bold").text("Executive Summary");
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    const total = complaints.length;
    const resolved = complaints.filter(
      (c) => normalizeStatus(c.status) === "resolved",
    ).length;
    const pending = complaints.filter(
      (c) => normalizeStatus(c.status) === "pending",
    ).length;
    const inProgress = complaints.filter(
      (c) => normalizeStatus(c.status) === "in-progress",
    ).length;
    const avgResponseTime = this.calculateAverageResponseTime(complaints);

    doc.fontSize(11).font("Helvetica");
    doc.text(`Total Complaints: ${total}`, { continued: false });
    doc.text(
      `Resolved: ${resolved} (${total > 0 ? ((resolved / total) * 100).toFixed(1) : 0}%)`,
    );
    doc.text(`In Progress: ${inProgress}`);
    doc.text(`Pending: ${pending}`);
    doc.text(`Average Response Time: ${avgResponseTime} hours`);
    doc.moveDown(1);

    // Department Breakdown
    doc.fontSize(14).font("Helvetica-Bold").text("Department-wise Breakdown");
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    const deptStats = this.getDepartmentStats(complaints);
    doc.fontSize(10).font("Helvetica");
    Object.entries(deptStats).forEach(([dept, stats]) => {
      doc.text(
        `${dept}: ${stats.total} complaints (${stats.resolved} resolved, ${stats.pending} pending)`,
      );
    });
    doc.moveDown(1);

    // Priority Distribution
    doc.fontSize(14).font("Helvetica-Bold").text("Priority Distribution");
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    const highPriority = complaints.filter((c) => c.priority === "High").length;
    const mediumPriority = complaints.filter(
      (c) => c.priority === "Medium",
    ).length;
    const lowPriority = complaints.filter((c) => c.priority === "Low").length;

    doc.fontSize(10).font("Helvetica");
    doc.text(
      `High Priority: ${highPriority} (${total > 0 ? ((highPriority / total) * 100).toFixed(1) : 0}%)`,
    );
    doc.text(
      `Medium Priority: ${mediumPriority} (${total > 0 ? ((mediumPriority / total) * 100).toFixed(1) : 0}%)`,
    );
    doc.text(
      `Low Priority: ${lowPriority} (${total > 0 ? ((lowPriority / total) * 100).toFixed(1) : 0}%)`,
    );
    doc.moveDown(1);

    // Recent Complaints (Limited to first 30)
    if (complaints.length > 0) {
      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").text("Recent Complaints");
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      doc.fontSize(9).font("Helvetica");

      complaints.forEach((complaint, index) => {
        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
          doc.fontSize(9);
        }

        doc
          .font("Helvetica-Bold")
          .text(`${index + 1}. ${complaint.ticketId}`, { continued: true });
        doc
          .font("Helvetica")
          .text(
            ` - ${complaint.refinedText || complaint.rawText || "No description"}`,
          );
        doc.text(
          `   Status: ${complaint.status} | Priority: ${complaint.priority} | Department: ${complaint.department}`,
        );
        doc.text(`   Location: ${complaint.locationName || "Not specified"}`);
        if (complaint.assignedWorkers?.[0]?.workerId) {
          const worker = complaint.assignedWorkers[0].workerId;
          doc.text(`   Assigned to: ${worker.fullName || worker.username}`);
        }
        doc.moveDown(0.3);
      });
    }

    // Footer on each page
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      const footerY =
        doc.page.height - Math.max(doc.page.margins.bottom, 40) - 12;
      doc
        .fontSize(8)
        .font("Helvetica")
        .text(
          `Page ${i + 1} of ${pages.count}`,
          doc.page.margins.left,
          footerY,
          {
            width:
              doc.page.width - doc.page.margins.left - doc.page.margins.right,
            align: "center",
            lineBreak: false,
          },
        );
    }

    doc.end();
    return bufferReady;
  }

  // Generate CSV Report
  async generateCSVReport(filters = {}, userId) {
    try {
      const complaints = await fetchComplaintsForReport(filters, CSV_MAX_ROWS);

      // Prepare CSV data
      const csvData = [
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
      ];

      complaints.forEach((complaint) => {
        const resolvedAt = getResolvedAt(complaint);
        csvData.push([
          complaint.ticketId || "N/A",
          complaint.refinedText || complaint.rawText || "No title",
          complaint.department || "N/A",
          complaint.priority || "Medium",
          complaint.status || "pending",
          complaint.locationName || "Not specified",
          complaint.userId?.fullName || complaint.userId?.username || "Unknown",
          complaint.assignedWorkers?.[0]?.workerId?.fullName ||
            complaint.assignedWorkers?.[0]?.workerId?.username ||
            "Unassigned",
          complaint.createdAt
            ? new Date(complaint.createdAt).toLocaleDateString("en-GB")
            : "N/A",
          resolvedAt ? resolvedAt.toLocaleDateString("en-GB") : "Pending",
          this.calculateResponseTime(complaint),
          complaint.upvoteCount || 0,
          complaint.feedback?.rating ? `${complaint.feedback.rating}/5` : "N/A",
        ]);
      });

      // Convert to CSV string
      let csvString = "";
      csvData.forEach((row) => {
        csvString += row.map((cell) => toCsvCell(cell)).join(",") + "\n";
      });

      return Buffer.from(csvString, "utf-8");
    } catch (error) {
      console.error("CSV generation error:", error);
      throw new Error("Failed to generate CSV report");
    }
  }

  // Helper: Calculate response time for a complaint
  calculateResponseTime(complaint) {
    if (!complaint.assignedAt || !complaint.createdAt) {
      return "N/A";
    }
    const diffMs =
      new Date(complaint.assignedAt) - new Date(complaint.createdAt);
    const hours = Math.round(diffMs / (1000 * 60 * 60));
    return hours > 0 ? hours : "<1";
  }

  // Helper: Calculate average response time
  calculateAverageResponseTime(complaints) {
    const withResponseTime = complaints.filter(
      (c) => c.assignedAt && c.createdAt,
    );
    if (withResponseTime.length === 0) return "N/A";

    const totalHours = withResponseTime.reduce((sum, c) => {
      const diffMs = new Date(c.assignedAt) - new Date(c.createdAt);
      const hours = diffMs / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    return Math.round(totalHours / withResponseTime.length);
  }

  // Helper: Get department statistics
  getDepartmentStats(complaints) {
    const stats = {};
    complaints.forEach((c) => {
      const dept = c.department || "Other";
      if (!stats[dept]) {
        stats[dept] = { total: 0, resolved: 0, pending: 0, inProgress: 0 };
      }
      stats[dept].total++;
      const status = normalizeStatus(c.status);
      if (status === "resolved") stats[dept].resolved++;
      else if (status === "pending") stats[dept].pending++;
      else if (status === "in-progress") stats[dept].inProgress++;
    });
    return stats;
  }
}

module.exports = new ReportService();
