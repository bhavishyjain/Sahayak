const { Resend } = require("resend");

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

function getAppWebBaseUrl() {
  return String(process.env.APP_LINK_BASE_URL).trim().replace(/\/+$/, "");
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

function getEmailReplyTo() {
  return String(process.env.EMAIL_REPLY_TO || "").trim();
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(value) {
  // Pragmatic email format guard to avoid provider-side hard bounces for obvious invalid input.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeRecipients(to) {
  const list = Array.isArray(to) ? to : [to];
  const normalized = Array.from(
    new Set(list.map(normalizeEmail).filter((email) => isValidEmail(email))),
  );
  return normalized;
}

function htmlToText(html = "") {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  attachments,
}) {
  assertEmailConfigured();
  const recipients = normalizeRecipients(to);

  if (recipients.length === 0) {
    throw new Error("No valid recipient email addresses were provided");
  }

  if (!subject) {
    throw new Error("Email subject is required");
  }

  const payload = {
    from: getEmailFrom(),
    to: recipients,
    subject,
    html: html || undefined,
    text: text || (html ? htmlToText(html) : undefined),
    attachments: attachments?.length ? attachments : undefined,
  };

  const replyTo = getEmailReplyTo();
  if (replyTo && isValidEmail(replyTo)) {
    payload.replyTo = replyTo;
  }

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    const detail = [error.message, error.name, error.statusCode]
      .filter(Boolean)
      .join(" | ");
    throw new Error(
      `Resend send failed: ${detail || "Unknown provider error"}`,
    );
  }

  return {
    success: true,
    messageId: data?.id,
  };
}

/**
 * Builds the shared HTML email shell.
 * @param {string} headerHtml    - HTML content inside the header div
 * @param {string} bodyHtml      - HTML content inside the content div
 * @param {string} extraCss      - Additional CSS rules specific to this email
 */
function buildEmailBase(headerHtml, bodyHtml, extraCss = "") {
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
          color: #1f2937;
          margin: 0;
          padding: 0;
          background-color: #f9fafb;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          background: white;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
        }
        .header {
          background: white;
          color: #1f2937;
          padding: 32px 20px;
          text-align: center;
          border-bottom: 1px solid #e5e7eb;
        }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 32px; }
        .footer {
          text-align: center;
          padding: 24px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 12px;
          border-top: 1px solid #e5e7eb;
        }
        .footer p { margin: 4px 0; }
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
    const recipient = normalizeEmail(email);
    if (!isValidEmail(recipient)) {
      throw new Error("Invalid recipient email address");
    }

    const inviteLink = buildAppUrl("/accept-invite", {
      token: inviteToken,
      email: recipient,
      department,
      role: invitedRole,
    });
    const inviteDeepLink = buildDeepLink("accept-invite", {
      token: inviteToken,
      email: recipient,
      department,
      role: invitedRole,
    });
    const roleLabel = invitedRole === "head" ? "department head" : "worker";

    const headerHtml = `<h1>You're Invited</h1>`;

    const bodyHtml = `
      <p>Hello,</p>
      <p><strong>${hodName}</strong> has invited you to join the <strong>${department} Department</strong> as a <strong>${roleLabel}</strong> in the Sahayak system.</p>

      <p style="margin-top: 20px; margin-bottom: 8px;"><strong>Responsibilities:</strong></p>
      <ul style="margin: 8px 0; padding-left: 20px;">
        ${
          invitedRole === "head"
            ? `
        <li>Review and manage department complaints</li>
        <li>Assign and supervise workers</li>
        <li>Track department performance metrics</li>
        <li>Coordinate with citizens and workers</li>
        <li>Approve, rework, or escalate complaint actions</li>
        `
            : `
        <li>Receive and manage complaint assignments</li>
        <li>Update complaint status in real-time</li>
        <li>Track your performance metrics</li>
        <li>Communicate with citizens and department heads</li>
        <li>Help resolve citizen complaints effectively</li>
        `
        }
      </ul>

      <p style="margin-top: 20px;">To accept this invitation, tap the button below:</p>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${inviteLink}" class="button">Accept Invitation</a>
      </div>

      <p style="margin-top: 24px; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        This invitation expires in 7 days. This is an automated email. Please do not reply.
      </p>
    `;

    const extraCss = `
      .button {
        display: inline-block;
        background: #1f2937;
        color: white;
        padding: 12px 32px;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 600;
        font-size: 15px;
      }
    `;

    const html = buildEmailBase(headerHtml, bodyHtml, extraCss);

    const result = await sendTransactionalEmail({
      to: [recipient],
      subject: `Invitation to Join ${department} Department as ${invitedRole === "head" ? "Department Head" : "Worker"}`,
      html,
    });

    console.log("✅ Invitation email sent:", result.messageId);
    return result;
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
    const { ticketId, title, department, priority, locationName } =
      complaintData;
    const viewLink = buildAppUrl("/complaints/complaint-details", {
      id: complaintData._id,
    });

    const headerHtml = `
      <h1>Complaint Registered</h1>
      <p style="margin: 8px 0 0 0; color: #6b7280; font-weight: 500;">Ticket #${ticketId}</p>
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

      <p style="margin-top: 24px; margin-bottom: 8px;"><strong>What happens next:</strong></p>
      <ol style="margin: 8px 0; padding-left: 20px; color: #4b5563;">
        <li style="margin-bottom: 6px;">Your complaint will be reviewed by the department head</li>
        <li style="margin-bottom: 6px;">A worker will be assigned to resolve the issue</li>
        <li style="margin-bottom: 6px;">You'll receive updates via email and in-app notifications</li>
        <li>You can track progress in real-time in the app</li>
      </ol>

      <div style="text-align: center; margin: 24px 0;">
        <a href="${viewLink}" class="button">Track Your Complaint</a>
      </div>
    `;

    const extraCss = `
      .info-box {
        background: #f9fafb;
        border-radius: 4px;
        padding: 16px;
        margin: 16px 0;
        border: 1px solid #e5e7eb;
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 14px;
      }
      .info-row:last-child { border-bottom: none; }
      .label { font-weight: 600; color: #6b7280; }
      .value { color: #1f2937; text-align: right; }
      .priority-high { font-weight: 600; }
      .priority-medium { font-weight: 600; }
      .priority-low { font-weight: 600; }
      .button {
        display: inline-block;
        background: #1f2937;
        color: white;
        padding: 12px 32px;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 600;
        font-size: 15px;
      }
    `;

    const html = buildEmailBase(headerHtml, bodyHtml, extraCss);

    const result = await sendTransactionalEmail({
      to: [userEmail],
      subject: `Complaint Registered - Ticket #${ticketId}`,
      html,
    });

    console.log("✅ Complaint registration email sent:", result.messageId);
    return result;
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
    const viewLink = buildAppUrl("/complaints/complaint-details", {
      id: complaintData._id,
    });

    const headerHtml = `
      <h1>Complaint Resolved</h1>
      <p style="margin: 8px 0 0 0; color: #6b7280; font-weight: 500;">Ticket #${ticketId}</p>
    `;

    const bodyHtml = `
      <p>Hello,</p>
      <p>Your complaint has been successfully resolved by the ${department} Department.</p>

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

      <div style="text-align: center; margin: 24px 0;">
        <a href="${viewLink}" class="button">View Complaint Details</a>
      </div>

      <p style="color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 16px;">
        If you need further assistance, you can access your complaint details through the Sahayak app.
      </p>
    `;

    const extraCss = `
      .info-box {
        background: #f9fafb;
        border-radius: 4px;
        padding: 16px;
        margin: 16px 0;
        border: 1px solid #e5e7eb;
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #e5e7eb;
        font-size: 14px;
      }
      .info-row:last-child { border-bottom: none; }
      .label { font-weight: 600; color: #6b7280; }
      .value { color: #1f2937; text-align: right; }
      .button {
        display: inline-block;
        background: #1f2937;
        color: white;
        padding: 12px 32px;
        text-decoration: none;
        border-radius: 4px;
        font-weight: 600;
        font-size: 15px;
        border-radius: 4px;
      }
      .feedback-box h3 { margin-top: 0; color: #92400e; }
    `;

    const html = buildEmailBase(headerHtml, bodyHtml, extraCss);

    const result = await sendTransactionalEmail({
      to: [userEmail],
      subject: `Complaint Resolved - Ticket #${ticketId}`,
      html,
    });

    console.log("✅ Complaint completion email sent:", result.messageId);
    return result;
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

  const result = await sendTransactionalEmail({
    to,
    subject,
    text,
    html,
    attachments: normalizedAttachments,
  });

  return result;
};

/**
 * Send email verification link
 */
const sendEmailVerification = async (email, fullName, token) => {
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

  const html = buildEmailBase(headerHtml, bodyHtml, extraCss);

  const result = await sendTransactionalEmail({
    to: [email],
    subject: "Verify your Sahayak email address",
    html,
  });
  return result;
};

/**
 * Send password reset link
 */
const sendPasswordResetEmail = async (email, fullName, token) => {
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

  const html = buildEmailBase(headerHtml, bodyHtml, extraCss);

  const result = await sendTransactionalEmail({
    to: [email],
    subject: "Reset your Sahayak password",
    html,
  });
  return result;
};

module.exports = {
  sendWorkerInvitation,
  sendComplaintRegistered,
  sendComplaintCompleted,
  sendEmailWithAttachment,
  sendEmailVerification,
  sendPasswordResetEmail,
};
