const normalizeApiBase = (value) => value?.trim().replace(/\/+$/, "") || "";
const API_BASE_DEV =
  normalizeApiBase(process.env.EXPO_PUBLIC_API_URL_DEV);
const API_BASE_PROD = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL_PROD);

export const API_BASE = __DEV__ ? API_BASE_DEV : API_BASE_PROD;
console.log("API_BASE:", API_BASE, "DEV:", __DEV__);

// ============================================================================
// AUTH URLs
// ============================================================================
export const REFRESH_URL = API_BASE + "/auth/refresh";
export const LOGIN_URL = API_BASE + "/auth/login";
export const REGISTER_URL = API_BASE + "/auth/register";
export const LOGOUT_URL = API_BASE + "/auth/logout";
export const GET_ME_URL = API_BASE + "/auth/me";
export const UPDATE_USER_PROFILE_URL = API_BASE + "/auth/me";
export const ACCEPT_INVITE_URL = API_BASE + "/auth/accept-invite";
export const DELETE_ACCOUNT_URL = API_BASE + "/auth/me";
export const FORGOT_PASSWORD_URL = API_BASE + "/auth/forgot-password";
export const RESET_PASSWORD_URL = (token) =>
  API_BASE + `/auth/reset-password/${token}`;
export const VERIFY_EMAIL_URL = (token) =>
  API_BASE + `/auth/verify-email/${token}`;
export const RESEND_VERIFICATION_URL = API_BASE + "/auth/resend-verification";

// ============================================================================
// COMPLAINT URLs
// ============================================================================
export const CREATE_COMPLAINT_URL = API_BASE + "/complaints";
export const GET_MY_COMPLAINTS_URL = API_BASE + "/complaints";
export const GET_COMPLAINT_BY_ID_URL = (id) => API_BASE + `/complaints/${id}`;
export const UPVOTE_COMPLAINT_URL = (id) =>
  API_BASE + `/complaints/${id}/upvote`;
export const SUBMIT_FEEDBACK_URL = (id) =>
  API_BASE + `/complaints/${id}/feedback`;
export const UPLOAD_COMPLETION_PHOTOS_URL = (id) =>
  API_BASE + `/complaints/${id}/completion-photos`;
export const SATISFACTION_VOTE_URL = (id) =>
  API_BASE + `/complaints/${id}/satisfaction-vote`;
export const GET_SATISFACTION_URL = (id) =>
  API_BASE + `/complaints/${id}/satisfaction`;
export const APPLY_AI_SUGGESTION_URL = (id) =>
  API_BASE + `/complaints/${id}/apply-ai-suggestion`;
export const GET_NEARBY_COMPLAINTS_URL = API_BASE + "/complaints/nearby";
export const AI_REVIEW_URL = API_BASE + "/complaints/ai-review/pending";
export const GET_COMPLAINT_MESSAGES_URL = (id) =>
  API_BASE + `/complaints/${id}/messages`;
export const POST_COMPLAINT_MESSAGE_URL = (id) =>
  API_BASE + `/complaints/${id}/messages`;

// ============================================================================
// ANALYTICS URLs
// ============================================================================
export const GET_ANALYTICS_SUMMARY_URL = API_BASE + "/analytics/summary";
export const GET_HEATMAP_URL = API_BASE + "/analytics/heatmap";

// ============================================================================
// NOTIFICATION URLs
// ============================================================================
export const NOTIFICATIONS_URL = API_BASE + "/notifications";
export const NOTIFICATION_REGISTER_TOKEN_URL =
  API_BASE + "/notifications/register-token";
export const NOTIFICATION_HISTORY_URL = API_BASE + "/notifications/history";
export const NOTIFICATION_MARK_ALL_READ_URL =
  API_BASE + "/notifications/read-all";
export const NOTIFICATION_MARK_READ_URL = (id) =>
  API_BASE + `/notifications/${id}/read`;
export const NOTIFICATION_PREFERENCES_URL =
  API_BASE + "/notifications/preferences";

// ============================================================================
// CHAT URLs
// ============================================================================
export const CHAT_URL = API_BASE + "/chat";

// ============================================================================
// WORKER URLs
// ============================================================================
export const WORKERS_URL = API_BASE + "/workers";
export const WORKER_DASHBOARD_SUMMARY_URL =
  API_BASE + "/workers/dashboard-summary";
export const WORKER_ACTIVE_PREVIEW_URL = API_BASE + "/workers/active-preview";
export const WORKER_ASSIGNED_URL = API_BASE + "/workers/assigned-complaints";
export const WORKER_COMPLETED_URL = API_BASE + "/workers/completed-complaints";
export const WORKER_FEEDBACK_URL = API_BASE + "/workers/feedback";
export const WORKER_LEADERBOARD_URL = API_BASE + "/workers/leaderboard";
export const WORKER_ANALYTICS_URL = API_BASE + "/workers/analytics";
export const UPDATE_COMPLAINT_STATUS_URL = (id) =>
  API_BASE + `/workers/complaint/${id}/status`;

// ============================================================================
// HOD URLs
// ============================================================================
export const HOD_URL = API_BASE + "/hod";
export const HOD_DASHBOARD_SUMMARY_URL = API_BASE + "/hod/dashboard-summary";
export const HOD_OVERVIEW_URL = API_BASE + "/hod/overview";
export const HOD_WORKERS_URL = API_BASE + "/hod/workers";
export const HOD_WORKER_DETAIL_URL = (workerId) =>
  API_BASE + `/hod/workers/${workerId}`;
export const HOD_WORKER_COMPLAINTS_URL = (workerId) =>
  API_BASE + `/hod/workers/${workerId}/complaints`;
export const HOD_APPROVE_COMPLETION_URL = (id) =>
  API_BASE + `/hod/approve-completion/${id}`;
export const HOD_NEEDS_REWORK_URL = (id) =>
  API_BASE + `/hod/needs-rework/${id}`;
export const HOD_CANCEL_COMPLAINT_URL = (id) =>
  API_BASE + `/hod/cancel-complaint/${id}`;
export const HOD_INVITE_WORKER_URL = API_BASE + "/hod/invite-worker";
export const HOD_INVITATIONS_URL = API_BASE + "/hod/invitations";
export const HOD_REVOKE_INVITATION_URL = (id) =>
  API_BASE + `/hod/invitations/${id}`;
export const HOD_REMOVE_WORKER_URL = (workerId) =>
  API_BASE + `/hod/workers/${workerId}`;
export const HOD_ASSIGN_MULTIPLE_WORKERS_URL = (complaintId) =>
  API_BASE + `/hod/complaints/${complaintId}/assign-workers`;
export const HOD_UPDATE_WORKER_TASK_URL = (complaintId, workerId) =>
  API_BASE + `/hod/complaints/${complaintId}/workers/${workerId}`;
export const HOD_GET_COMPLAINT_WORKERS_URL = (complaintId) =>
  API_BASE + `/hod/complaints/${complaintId}/workers`;

// ============================================================================
// REPORT URLs
// ============================================================================
export const REPORT_STATS_URL = API_BASE + "/reports/stats";
export const REPORT_DEPARTMENT_BREAKDOWN_URL =
  API_BASE + "/reports/department-breakdown";
export const REPORT_DOWNLOAD_URL = (format) => API_BASE + `/reports/${format}`;
export const REPORT_SCHEDULE_URL = API_BASE + "/reports/schedule";
export const REPORT_SCHEDULES_URL = API_BASE + "/reports/schedule"; // GET list — same path as POST create
export const REPORT_RUN_NOW_URL = (id) =>
  API_BASE + `/reports/schedule/${id}/run-now`;
export const REPORT_CANCEL_SCHEDULE_URL = (id) =>
  API_BASE + `/reports/schedule/${id}`;
export const REPORT_EMAIL_URL = API_BASE + "/reports/email";

// ============================================================================
// LEGACY/OPTIONAL URLs
// ============================================================================
export const GET_PRESIGNED_UPLOAD_URL = API_BASE + "/uploads/presigned-url";

// ============================================================================
// HEALTH CHECK
// ============================================================================
export const HEALTH_CHECK_URL = API_BASE + "/health";
