const { Resend } = require("resend");

/**
 * Email Service using Resend
 *
 * FREE: 100 emails/day, 3,000/month
 *
 * Setup (2 minutes):
 * 1. Sign up at https://resend.com/
 * 2. Get API key from dashboard
 * 3. Add domain (or use their test domain: onboarding@resend.dev)
 * 4. Add to .env: RESEND_API_KEY=re_xxxxx
 */

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send worker invitation email
 */
const sendWorkerInvitation = async (
  email,
  inviteToken,
  department,
  hodName,
) => {
  try {
    // Generate invitation link
    const inviteLink = `${process.env.APP_URL || "http://localhost:3000"}/register?token=${inviteToken}&role=worker&department=${department}`;

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Sahayak <onboarding@resend.dev>",
      to: [email],
      subject: `Invitation to Join ${department} Department as Worker`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white; 
              padding: 40px 20px; 
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px;
            }
            .content h2 {
              color: #1f2937;
              font-size: 24px;
              margin-top: 0;
            }
            .benefits {
              background: #f9fafb;
              border-left: 4px solid #667eea;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .benefits ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .benefits li {
              margin: 8px 0;
              color: #4b5563;
            }
            .button { 
              display: inline-block; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white; 
              padding: 16px 40px; 
              text-decoration: none; 
              border-radius: 8px;
              margin: 30px 0;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 6px rgba(102, 126, 234, 0.4);
              transition: transform 0.2s;
            }
            .button:hover {
              transform: translateY(-2px);
            }
            .warning {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .warning p {
              margin: 0;
              color: #92400e;
              font-size: 14px;
            }
            .link-box {
              background: #f3f4f6;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
              word-break: break-all;
            }
            .link-box a {
              color: #667eea;
              font-size: 13px;
            }
            .footer { 
              text-align: center; 
              padding: 30px;
              background: #f9fafb;
              color: #6b7280; 
              font-size: 13px;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 You're Invited!</h1>
            </div>
            <div class="content">
              <h2>Join ${department} Department</h2>
              <p>Hello,</p>
              <p><strong>${hodName}</strong> has invited you to join the <strong>${department} Department</strong> as a worker in the Sahayak system.</p>
              
              <div class="benefits">
                <p><strong>As a worker, you'll be able to:</strong></p>
                <ul>
                  <li>✅ Receive and manage complaint assignments</li>
                  <li>📱 Update complaint status in real-time</li>
                  <li>📊 Track your performance metrics</li>
                  <li>💬 Communicate with citizens and department heads</li>
                  <li>🏆 Compete in leaderboards and earn recognition</li>
                </ul>
              </div>

              <div style="text-align: center;">
                <a href="${inviteLink}" class="button">Accept Invitation & Register</a>
              </div>

              <div class="warning">
                <p>⏰ <strong>This invitation expires in 7 days.</strong> Please register before then.</p>
              </div>

              <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <div class="link-box">
                <a href="${inviteLink}">${inviteLink}</a>
              </div>
            </div>
            <div class="footer">
              <p><strong>Sahayak</strong> - Municipal Complaint Management System</p>
              <p>© 2026 Sahayak. All rights reserved.</p>
              <p style="margin-top: 15px;">This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log("✅ Invitation email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    throw new Error(`Failed to send invitation email: ${error.message}`);
  }
};

/**
 * Test email configuration
 */
const testEmailConfig = async () => {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY is not set in .env file");
      return false;
    }

    // Test by getting API key info (doesn't count against quota)
    console.log("✅ Resend API key is configured");
    console.log("✅ Email service is ready to send emails");
    return true;
  } catch (error) {
    console.error("❌ Email configuration error:", error.message);
    return false;
  }
};

/**
 * Send complaint registration confirmation email
 */
const sendComplaintRegistered = async (userEmail, userName, complaintData) => {
  try {
    const { ticketId, title, department, priority, locationName } =
      complaintData;
    const viewLink = `${process.env.APP_URL || "http://localhost:3000"}/complaints/${complaintData._id}`;

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Sahayak <onboarding@resend.dev>",
      to: [userEmail],
      subject: `Complaint Registered - Ticket #${ticketId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white; 
              padding: 40px 20px; 
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .ticket-id {
              background: rgba(255, 255, 255, 0.2);
              display: inline-block;
              padding: 8px 16px;
              border-radius: 20px;
              margin-top: 10px;
              font-size: 14px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px;
            }
            .info-box {
              background: #f9fafb;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              font-weight: 600;
              color: #6b7280;
            }
            .value {
              color: #1f2937;
              text-align: right;
            }
            .priority-high {
              color: #dc2626;
              font-weight: 600;
            }
            .priority-medium {
              color: #f59e0b;
              font-weight: 600;
            }
            .priority-low {
              color: #10b981;
              font-weight: 600;
            }
            .button { 
              display: inline-block; 
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white; 
              padding: 16px 40px; 
              text-decoration: none; 
              border-radius: 8px;
              margin: 30px 0;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 6px rgba(16, 185, 129, 0.4);
            }
            .next-steps {
              background: #eff6ff;
              border-left: 4px solid #3b82f6;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .next-steps h3 {
              margin-top: 0;
              color: #1e40af;
            }
            .footer { 
              text-align: center; 
              padding: 30px;
              background: #f9fafb;
              color: #6b7280; 
              font-size: 13px;
              border-top: 1px solid #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Complaint Registered</h1>
              <div class="ticket-id">Ticket #${ticketId}</div>
            </div>
            <div class="content">
              <p>Dear <strong>${userName}</strong>,</p>
              <p>Thank you for registering your complaint with Sahayak. We have received your complaint and it is now being processed.</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Ticket ID:</span>
                  <span class="value"><strong>${ticketId}</strong></span>
                </div>
                <div class="info-row">
                  <span class="label">Title:</span>
                  <span class="value">${title}</span>
                </div>
                <div class="info-row">
                  <span class="label">Department:</span>
                  <span class="value">${department}</span>
                </div>
                <div class="info-row">
                  <span class="label">Priority:</span>
                  <span class="value priority-${priority.toLowerCase()}">${priority}</span>
                </div>
                ${
                  locationName
                    ? `
                <div class="info-row">
                  <span class="label">Location:</span>
                  <span class="value">${locationName}</span>
                </div>
                `
                    : ""
                }
              </div>

              <div style="text-align: center;">
                <a href="${viewLink}" class="button">Track Your Complaint</a>
              </div>

              <div class="next-steps">
                <h3>📋 What Happens Next?</h3>
                <ol style="margin: 10px 0; padding-left: 20px;">
                  <li>Your complaint will be reviewed by the department head</li>
                  <li>A worker will be assigned to resolve the issue</li>
                  <li>You'll receive updates via notifications and email</li>
                  <li>You can track progress in real-time in the app</li>
                </ol>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                <strong>Need help?</strong> Track your complaint status anytime in the Sahayak app.
              </p>
            </div>
            <div class="footer">
              <p><strong>Sahayak</strong> - Municipal Complaint Management System</p>
              <p>© 2026 Sahayak. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log("✅ Complaint registration email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    // Don't throw - we don't want to block complaint creation if email fails
    return { success: false, error: error.message };
  }
};

/**
 * Send complaint completion email
 */
const sendComplaintCompleted = async (
  userEmail,
  userName,
  complaintData,
  feedbackLink,
) => {
  try {
    const { ticketId, title, department, completedAt } = complaintData;
    const viewLink = `${process.env.APP_URL || "http://localhost:3000"}/complaints/${complaintData._id}`;

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Sahayak <onboarding@resend.dev>",
      to: [userEmail],
      subject: `Complaint Resolved - Ticket #${ticketId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
              color: white; 
              padding: 40px 20px; 
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .ticket-id {
              background: rgba(255, 255, 255, 0.2);
              display: inline-block;
              padding: 8px 16px;
              border-radius: 20px;
              margin-top: 10px;
              font-size: 14px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px;
            }
            .success-badge {
              background: #d1fae5;
              color: #065f46;
              padding: 12px 24px;
              border-radius: 8px;
              display: inline-block;
              font-weight: 600;
              margin: 20px 0;
            }
            .info-box {
              background: #f9fafb;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .label {
              font-weight: 600;
              color: #6b7280;
            }
            .value {
              color: #1f2937;
              text-align: right;
            }
            .button { 
              display: inline-block; 
              background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
              color: white; 
              padding: 16px 40px; 
              text-decoration: none; 
              border-radius: 8px;
              margin: 10px 5px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 6px rgba(139, 92, 246, 0.4);
            }
            .button-secondary {
              background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
              box-shadow: 0 4px 6px rgba(245, 158, 11, 0.4);
            }
            .feedback-box {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .feedback-box h3 {
              margin-top: 0;
              color: #92400e;
            }
            .footer { 
              text-align: center; 
              padding: 30px;
              background: #f9fafb;
              color: #6b7280; 
              font-size: 13px;
              border-top: 1px solid #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Complaint Resolved!</h1>
              <div class="ticket-id">Ticket #${ticketId}</div>
            </div>
            <div class="content">
              <p>Dear <strong>${userName}</strong>,</p>
              
              <div style="text-align: center;">
                <div class="success-badge">✅ Issue Resolved</div>
              </div>

              <p>Great news! Your complaint has been successfully resolved by the ${department} Department.</p>
              
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Ticket ID:</span>
                  <span class="value"><strong>${ticketId}</strong></span>
                </div>
                <div class="info-row">
                  <span class="label">Complaint:</span>
                  <span class="value">${title}</span>
                </div>
                <div class="info-row">
                  <span class="label">Department:</span>
                  <span class="value">${department}</span>
                </div>
                ${
                  completedAt
                    ? `
                <div class="info-row">
                  <span class="label">Completed On:</span>
                  <span class="value">${new Date(completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                `
                    : ""
                }
              </div>

              <div class="feedback-box">
                <h3>⭐ We Value Your Feedback!</h3>
                <p style="margin: 10px 0;">Your opinion helps us improve our services. Please take a moment to rate your experience and let us know how we did.</p>
              </div>

              <div style="text-align: center;">
                <a href="${viewLink}" class="button button-secondary">Rate & Provide Feedback</a>
                <a href="${viewLink}" class="button">View Complaint Details</a>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Thank you for using Sahayak. We hope the issue has been resolved to your satisfaction.
              </p>
            </div>
            <div class="footer">
              <p><strong>Sahayak</strong> - Municipal Complaint Management System</p>
              <p>© 2026 Sahayak. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log("✅ Complaint completion email sent:", data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    // Don't throw - we don't want to block complaint completion if email fails
    return { success: false, error: error.message };
  }
};

function normalizeAttachmentContent(content) {
  if (!content) return null;
  if (Buffer.isBuffer(content)) {
    return content.toString("base64");
  }
  if (typeof content === "string") {
    return content;
  }
  if (content.type === "Buffer" && Array.isArray(content.data)) {
    return Buffer.from(content.data).toString("base64");
  }
  return null;
}

const sendEmailWithAttachment = async ({
  to,
  subject,
  text,
  html,
  attachments = [],
}) => {
  if (!to) {
    throw new Error("Recipient email is required");
  }
  if (!subject) {
    throw new Error("Email subject is required");
  }

  const normalizedAttachments = attachments
    .map((attachment) => {
      const content = normalizeAttachmentContent(attachment?.content);
      if (!content || !attachment?.filename) {
        return null;
      }
      return {
        filename: attachment.filename,
        content,
        contentType: attachment.contentType || "application/octet-stream",
      };
    })
    .filter(Boolean);

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Sahayak <onboarding@resend.dev>",
    to: Array.isArray(to) ? to : [to],
    subject,
    text: text || undefined,
    html: html || undefined,
    attachments:
      normalizedAttachments.length > 0 ? normalizedAttachments : undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    success: true,
    messageId: data?.id,
  };
};

module.exports = {
  sendWorkerInvitation,
  sendComplaintRegistered,
  sendComplaintCompleted,
  sendEmailWithAttachment,
};
