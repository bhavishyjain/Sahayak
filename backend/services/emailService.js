const { Resend } = require("resend");

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

function getAppWebBaseUrl() {
  return String(process.env.APP_LINK_BASE_URL || "https://sahayak.app")
    .trim()
    .replace(/\/+$/, "");
}

function buildAppUrl(pathname = "/", params = {}) {
  const url = new URL(`${getAppWebBaseUrl()}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function buildDeepLink(pathname = "", params = {}) {
  const normalizedPath = String(pathname || "").replace(/^\/+/, "");
  const url = new URL(`sahayak://${normalizedPath}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function assertEmailConfigured() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Email service is not configured (missing RESEND_API_KEY)");
  }
  if (!process.env.EMAIL_FROM) {
    throw new Error("Email service is not configured (missing EMAIL_FROM)");
  }
}

function getEmailFrom() {
  return String(process.env.EMAIL_FROM || "").trim();
}

/**
 * Builds the shared HTML email shell.
 * @param {string} headerGradient - CSS gradient for the header background
 * @param {string} headerHtml    - HTML content inside the header div
 * @param {string} bodyHtml      - HTML content inside the content div
 * @param {string} extraCss      - Additional CSS rules specific to this email
 */
function buildEmailBase(headerGradient, headerHtml, bodyHtml, extraCss = "") {
  return `
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
          background: ${headerGradient};
          color: white;
          padding: 40px 20px;
          text-align: center;
        }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .footer {
          text-align: center;
          padding: 30px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 13px;
          border-top: 1px solid #e5e7eb;
        }
        .footer p { margin: 5px 0; }
        ${extraCss}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">${headerHtml}</div>
        <div class="content">${bodyHtml}</div>
        <div class="footer">
          <p><strong>Sahayak</strong> - Municipal Complaint Management System</p>
          <p>© 2026 Sahayak. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send worker invitation email
 */
const sendWorkerInvitation = async (
  email,
  inviteToken,
  department,
  hodName,
  invitedRole = "worker",
) => {
  try {
    assertEmailConfigured();
    const inviteLink = buildAppUrl("/accept-invite", {
      token: inviteToken,
      email,
      department,
      role: invitedRole,
    });
    const inviteDeepLink = buildDeepLink("accept-invite", {
      token: inviteToken,
      email,
      department,
      role: invitedRole,
    });
    const roleLabel = invitedRole === "head" ? "department head" : "worker";

    const headerHtml = `<h1>🎉 You're Invited!</h1>`;

    const bodyHtml = `
      <h2 style="color: #1f2937; font-size: 24px; margin-top: 0;">Join ${department} Department</h2>
      <p>Hello,</p>
      <p><strong>${hodName}</strong> has invited you to join the <strong>${department} Department</strong> as a <strong>${roleLabel}</strong> in the Sahayak system.</p>

      <div class="benefits">
        <p><strong>As a ${roleLabel}, you'll be able to:</strong></p>
        <ul>
          ${
            invitedRole === "head"
              ? `
          <li>✅ Review and manage department complaints</li>
          <li>👷 Assign and supervise workers</li>
          <li>📊 Track department performance metrics</li>
          <li>💬 Coordinate with citizens and workers</li>
          <li>📌 Approve, rework, or escalate complaint actions</li>
          `
              : `
          <li>✅ Receive and manage complaint assignments</li>
          <li>📱 Update complaint status in real-time</li>
          <li>📊 Track your performance metrics</li>
          <li>💬 Communicate with citizens and department heads</li>
          <li>🏆 Compete in leaderboards and earn recognition</li>
          `
          }
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${inviteLink}" class="button">Open Sahayak App &amp; Accept</a>
      </div>

      <div class="warning">
        <p>⏰ <strong>This invitation expires in 7 days.</strong> Please register before then.</p>
      </div>

      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
        If the button doesn't work, open the Sahayak app and tap "I have an invite" on the login screen, then paste this link:
      </p>
      <div class="link-box">
        <a href="${inviteDeepLink}">${inviteDeepLink}</a>
      </div>

      <p style="margin-top: 30px; font-size: 13px; color: #6b7280; text-align: center;">
        This is an automated email. Please do not reply.
      </p>
    `;

    const extraCss = `
      .content h2 { color: #1f2937; font-size: 24px; margin-top: 0; }
      .benefits {
        background: #f9fafb;
        border-left: 4px solid #667eea;
        padding: 20px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .benefits ul { margin: 10px 0; padding-left: 20px; }
      .benefits li { margin: 8px 0; color: #4b5563; }
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
      }
      .warning {
        background: #fef3c7;
        border-left: 4px solid #f59e0b;
        padding: 15px;
        margin: 20px 0;
        border-radius: 4px;
      }
      .warning p { margin: 0; color: #92400e; font-size: 14px; }
      .link-box {
        background: #f3f4f6;
        padding: 15px;
        border-radius: 6px;
        margin: 20px 0;
        word-break: break-all;
      }
      .link-box a { color: #667eea; font-size: 13px; }
    `;

    const html = buildEmailBase(
      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      headerHtml,
      bodyHtml,
      extraCss,
    );

    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: [email],
      subject: `Invitation to Join ${department} Department as ${invitedRole === "head" ? "Department Head" : "Worker"}`,
      html,
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
 * Send complaint registration confirmation email
 */
const sendComplaintRegistered = async (userEmail, userName, complaintData) => {
  try {
    assertEmailConfigured();
    const { ticketId, title, department, priority, locationName } =
      complaintData;
    const viewLink = buildAppUrl("/complaints/complaint-details", {
      id: complaintData._id,
    });

    const headerHtml = `
      <h1>✅ Complaint Registered</h1>
      <div class="ticket-id">Ticket #${ticketId}</div>
    `;

    const bodyHtml = `
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
    `;

    const extraCss = `
      .ticket-id {
        background: rgba(255, 255, 255, 0.2);
        display: inline-block;
        padding: 8px 16px;
        border-radius: 20px;
        margin-top: 10px;
        font-size: 14px;
        font-weight: 600;
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
      .info-row:last-child { border-bottom: none; }
      .label { font-weight: 600; color: #6b7280; }
      .value { color: #1f2937; text-align: right; }
      .priority-high { color: #dc2626; font-weight: 600; }
      .priority-medium { color: #f59e0b; font-weight: 600; }
      .priority-low { color: #10b981; font-weight: 600; }
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
      .next-steps h3 { margin-top: 0; color: #1e40af; }
    `;

    const html = buildEmailBase(
      "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      headerHtml,
      bodyHtml,
      extraCss,
    );

    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: [userEmail],
      subject: `Complaint Registered - Ticket #${ticketId}`,
      html,
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
    assertEmailConfigured();
    const { ticketId, title, department, completedAt } = complaintData;
    const viewLink = buildAppUrl("/complaints/complaint-details", {
      id: complaintData._id,
    });

    const headerHtml = `
      <h1>🎉 Complaint Resolved!</h1>
      <div class="ticket-id">Ticket #${ticketId}</div>
    `;

    const bodyHtml = `
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
        <a href="${feedbackLink || viewLink}" class="button button-secondary">Rate &amp; Provide Feedback</a>
        <a href="${viewLink}" class="button">View Complaint Details</a>
      </div>

      <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
        Thank you for using Sahayak. We hope the issue has been resolved to your satisfaction.
      </p>
    `;

    const extraCss = `
      .ticket-id {
        background: rgba(255, 255, 255, 0.2);
        display: inline-block;
        padding: 8px 16px;
        border-radius: 20px;
        margin-top: 10px;
        font-size: 14px;
        font-weight: 600;
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
      .info-row:last-child { border-bottom: none; }
      .label { font-weight: 600; color: #6b7280; }
      .value { color: #1f2937; text-align: right; }
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
      .feedback-box h3 { margin-top: 0; color: #92400e; }
    `;

    const html = buildEmailBase(
      "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
      headerHtml,
      bodyHtml,
      extraCss,
    );

    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: [userEmail],
      subject: `Complaint Resolved - Ticket #${ticketId}`,
      html,
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
  assertEmailConfigured();
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
    from: getEmailFrom(),
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

/**
 * Send email verification link
 */
const sendEmailVerification = async (email, fullName, token) => {
  assertEmailConfigured();
  const verifyLink = buildAppUrl("/verify-email", { token });
  const verifyDeepLink = buildDeepLink("verify-email", { token });

  const headerHtml = `<h1>✉️ Verify Your Email</h1>`;
  const bodyHtml = `
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>Welcome to Sahayak! Please verify your email address to activate your account.</p>
    <div style="text-align: center;">
      <a href="${verifyLink}" class="button">Verify Email Address</a>
    </div>
    <div class="warning">
      <p>⏰ <strong>This link expires in 24 hours.</strong></p>
    </div>
    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
      If the button does not open the app, use this fallback link inside Sahayak:
    </p>
    <div class="link-box">
      <a href="${verifyDeepLink}">${verifyDeepLink}</a>
    </div>
    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
      If you didn't create a Sahayak account, you can safely ignore this email.
    </p>
  `;
  const extraCss = `
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
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning p { margin: 0; color: #92400e; font-size: 14px; }
    .link-box {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
      word-break: break-all;
    }
    .link-box a { color: #10b981; font-size: 13px; }
  `;

  const html = buildEmailBase(
    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    headerHtml,
    bodyHtml,
    extraCss,
  );

  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to: [email],
    subject: "Verify your Sahayak email address",
    html,
  });
  if (error) throw new Error(error.message);
  return { success: true, messageId: data.id };
};

/**
 * Send password reset link
 */
const sendPasswordResetEmail = async (email, fullName, token) => {
  assertEmailConfigured();
  const resetLink = buildAppUrl("/reset-password", { token });
  const resetDeepLink = buildDeepLink("reset-password", { token });

  const headerHtml = `<h1>🔑 Reset Your Password</h1>`;
  const bodyHtml = `
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>We received a request to reset the password for your Sahayak account.</p>
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    <div class="warning">
      <p>⏰ <strong>This link expires in 1 hour.</strong></p>
    </div>
    <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
      If the button does not open the app, use this fallback link inside Sahayak:
    </p>
    <div class="link-box">
      <a href="${resetDeepLink}">${resetDeepLink}</a>
    </div>
    <p style="color: #6b7280; font-size: 14px;">
      If you did not request a password reset, please ignore this email — your password will remain unchanged.
    </p>
  `;
  const extraCss = `
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 8px;
      margin: 30px 0;
      font-weight: 600;
      font-size: 16px;
    }
    .warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning p { margin: 0; color: #92400e; font-size: 14px; }
    .link-box {
      background: #f3f4f6;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
      word-break: break-all;
    }
    .link-box a { color: #d97706; font-size: 13px; }
  `;

  const html = buildEmailBase(
    "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    headerHtml,
    bodyHtml,
    extraCss,
  );

  const { data, error } = await resend.emails.send({
    from: getEmailFrom(),
    to: [email],
    subject: "Reset your Sahayak password",
    html,
  });
  if (error) throw new Error(error.message);
  return { success: true, messageId: data.id };
};

module.exports = {
  sendWorkerInvitation,
  sendComplaintRegistered,
  sendComplaintCompleted,
  sendEmailWithAttachment,
  sendEmailVerification,
  sendPasswordResetEmail,
};
