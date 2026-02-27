const Complaint = require("../models/Complaint");
const User = require("../models/User");
const { notifyUser } = require("../controllers/notificationController");

/**
 * Check and escalate overdue complaints
 * Should be run periodically (e.g., every hour via cron job)
 */
async function checkAndEscalateOverdueComplaints() {
  try {
    const now = new Date();

    // Find complaints that are overdue and not resolved/cancelled
    const overdueComplaints = await Complaint.find({
      "sla.dueDate": { $lt: now },
      status: { $nin: ["resolved", "cancelled", "needs-rework"] },
      "sla.isOverdue": false,
    });

    console.log(
      `Found ${overdueComplaints.length} overdue complaints to process`,
    );

    for (const complaint of overdueComplaints) {
      complaint.sla.isOverdue = true;

      // Escalate if not already escalated
      if (!complaint.sla.escalated) {
        complaint.sla.escalated = true;
        complaint.sla.escalationLevel += 1;

        // Auto-bump priority
        if (complaint.priority === "Low") {
          complaint.priority = "Medium";
        } else if (complaint.priority === "Medium") {
          complaint.priority = "High";
        }

        // Find HOD or admin to escalate to
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

          // Notify HOD
          await notifyUser(hod._id, {
            title: "Complaint Escalated - Overdue",
            body: `Complaint ${complaint.ticketId} is overdue and has been escalated to you.`,
            data: {
              type: "complaint_escalated",
              complaintId: String(complaint._id),
              ticketId: complaint.ticketId,
            },
          });
        }

        // Notify complaint owner
        if (complaint.userId) {
          await notifyUser(complaint.userId, {
            title: "Complaint Escalated",
            body: `Your complaint ${complaint.ticketId} has been escalated due to delay.`,
            data: {
              type: "complaint_escalated",
              complaintId: String(complaint._id),
              ticketId: complaint.ticketId,
            },
          });
        }

        // Add to history
        complaint.history.push({
          status: complaint.status,
          updatedBy: null,
          note: `Auto-escalated: Priority upgraded to ${complaint.priority} due to SLA breach`,
          timestamp: new Date(),
        });
      }

      await complaint.save();
    }

    return {
      success: true,
      processed: overdueComplaints.length,
    };
  } catch (error) {
    console.error("SLA escalation error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Setup auto-escalation cron job
 * Run every hour
 */
function setupSLAEscalationJob() {
  // Run every hour
  const interval = 60 * 60 * 1000; // 1 hour in milliseconds

  setInterval(async () => {
    console.log("Running SLA escalation check...");
    const result = await checkAndEscalateOverdueComplaints();
    console.log("SLA escalation result:", result);
  }, interval);

  // Run immediately on startup
  console.log("Running initial SLA escalation check...");
  checkAndEscalateOverdueComplaints().then((result) => {
    console.log("Initial SLA escalation result:", result);
  });
}

module.exports = {
  checkAndEscalateOverdueComplaints,
  setupSLAEscalationJob,
};
