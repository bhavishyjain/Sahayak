const Complaint = require("../models/Complaint");
const User = require("../models/User");
const {
  deliverNotificationToUser,
} = require("../services/notificationDeliveryService");
const cron = require("node-cron");
const {
  NOTIFICATION_ROUTE_SCREENS,
  buildNotificationRoute,
} = require("../services/notificationDomainService");

/**
 * Check and escalate overdue complaints
 * Should be run periodically (e.g., every hour via cron job)
 */
async function checkAndEscalateOverdueComplaints() {
  try {
    const now = new Date();
    // Re-escalate every 24 h so persistent overdue complaints keep escalating
    const reEscalateAfter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const MAX_ESCALATION_LEVEL = 3; // stop escalating beyond level 3

    const candidates = await Complaint.find({
      "sla.dueDate": { $lt: now },
      status: { $nin: ["resolved", "cancelled", "needs-rework"] },
      "sla.escalationLevel": { $lt: MAX_ESCALATION_LEVEL },
      $or: [
        { "sla.lastEscalatedAt": null },
        { "sla.lastEscalatedAt": { $lt: reEscalateAfter } },
      ],
    }).select("_id");

    console.log(
      `Found ${candidates.length} overdue complaints to process`,
    );

    let processed = 0;
    for (const candidate of candidates) {
      // Atomic claim to avoid duplicate escalation across multiple app instances.
      const complaint = await Complaint.findOneAndUpdate(
        {
          _id: candidate._id,
          "sla.dueDate": { $lt: now },
          status: { $nin: ["resolved", "cancelled", "needs-rework"] },
          "sla.escalationLevel": { $lt: MAX_ESCALATION_LEVEL },
          $or: [
            { "sla.lastEscalatedAt": null },
            { "sla.lastEscalatedAt": { $lt: reEscalateAfter } },
          ],
        },
        {
          $set: {
            "sla.isOverdue": true,
            "sla.escalated": true,
            "sla.lastEscalatedAt": now,
          },
          $inc: { "sla.escalationLevel": 1 },
        },
        { new: true },
      );

      if (!complaint) {
        continue;
      }

      try {
      if (complaint.priority === "Low") {
        complaint.priority = "Medium";
      } else if (complaint.priority === "Medium") {
        complaint.priority = "High";
      }

      const hod = await User.findOne({
        role: "head",
        department: complaint.department,
      });

      if (hod) {
        complaint.sla.escalationHistory.push({
          level: complaint.sla.escalationLevel,
          escalatedAt: new Date(),
          escalatedTo: hod._id,
        });

        await deliverNotificationToUser(hod._id, {
          title: "Complaint Escalated - Overdue",
          body: `Complaint ${complaint.ticketId} is overdue and has been escalated to you.`,
          data: {
            type: "complaint_escalated",
            complaintId: String(complaint._id),
            ticketId: complaint.ticketId,
            route: buildNotificationRoute(
              NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL,
              {
                complaintId: String(complaint._id),
                ticketId: complaint.ticketId,
              },
            ),
          },
        });
      }

      if (complaint.userId) {
        await deliverNotificationToUser(complaint.userId, {
          title: "Complaint Escalated",
          body: `Your complaint ${complaint.ticketId} has been escalated due to delay.`,
          data: {
            type: "complaint_escalated",
            complaintId: String(complaint._id),
            ticketId: complaint.ticketId,
            route: buildNotificationRoute(
              NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL,
              {
                complaintId: String(complaint._id),
                ticketId: complaint.ticketId,
              },
            ),
          },
        });
      }

      complaint.history.push({
        status: complaint.status,
        updatedBy: null,
        note: `Auto-escalated: Priority upgraded to ${complaint.priority} due to SLA breach`,
        timestamp: new Date(),
      });

      await complaint.save();
      processed += 1;
      } catch (iterErr) {
        console.error(
          `[sla-escalation] Failed to process complaint ${candidate._id}:`,
          iterErr.message,
        );
      }
    }

    return {
      success: true,
      processed,
    };
  } catch (error) {
    console.error("SLA escalation error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

let slaEscalationTask = null;

function setupSLAEscalationJob() {
  if (process.env.ENABLE_SLA_ESCALATION_JOB === "false") {
    console.log("SLA escalation job is disabled via ENABLE_SLA_ESCALATION_JOB=false");
    return;
  }

  if (slaEscalationTask) {
    return;
  }

  slaEscalationTask = cron.schedule("5 * * * *", async () => {
    console.log("Running SLA escalation check...");
    const result = await checkAndEscalateOverdueComplaints();
    console.log("SLA escalation result:", result);
  });

  if (process.env.SLA_ESCALATION_RUN_ON_STARTUP === "true") {
    console.log("Running initial SLA escalation check...");
    checkAndEscalateOverdueComplaints().then((result) => {
      console.log("Initial SLA escalation result:", result);
    });
  }

  // Reset currentWeekCompleted for all workers every Monday at midnight
  cron.schedule(
    "0 0 * * 1",
    async () => {
      try {
        await User.updateMany(
          { role: "worker" },
          { $set: { "performanceMetrics.currentWeekCompleted": 0 } },
        );
        console.log("[metrics-reset] Worker currentWeekCompleted reset");
      } catch (err) {
        console.error("[metrics-reset] Weekly reset failed:", err.message);
      }
    },
    { timezone: process.env.EVENT_TIMEZONE || "Asia/Kolkata" },
  );

  console.log("SLA escalation cron job started (hourly at minute 5)");
}

module.exports = {
  checkAndEscalateOverdueComplaints,
  setupSLAEscalationJob,
};
