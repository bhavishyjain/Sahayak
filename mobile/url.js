import { Platform } from "react-native";

// Base URL configuration
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || "https://sahayak-zqp7.onrender.com/api";

export const USER_AGENT_STRING =
  Platform.OS === "ios"
    ? "SAHAYAK_IOS"
    : Platform.OS === "android"
      ? "SAHAYAK_ANDROID"
      : "SAHAYAK_RN";

// ============================================================================
// AUTH URLs
// ============================================================================
export const LOGIN_URL = API_BASE + "/auth/login";
export const REGISTER_URL = API_BASE + "/auth/register";
export const LOGOUT_URL = API_BASE + "/auth/logout";
export const GET_ME_URL = API_BASE + "/auth/me";
export const UPDATE_USER_PROFILE_URL = API_BASE + "/auth/update-profile";

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

// ============================================================================
// DASHBOARD URLs
// ============================================================================
export const GET_DASHBOARD_SUMMARY_URL = API_BASE + "/dashboard/summary";
export const GET_HEATMAP_URL = API_BASE + "/dashboard/heatmap";

// ============================================================================
// NOTIFICATION URLs
// ============================================================================
export const NOTIFICATIONS_URL = API_BASE + "/notifications";

// ============================================================================
// CHAT URLs
// ============================================================================
export const CHAT_URL = API_BASE + "/chat";

// ============================================================================
// WORKER URLs
// ============================================================================
export const WORKERS_URL = API_BASE + "/workers";
export const WORKER_DASHBOARD_URL = API_BASE + "/workers/dashboard";
export const WORKER_ASSIGNED_URL = API_BASE + "/workers/assigned-complaints";
export const WORKER_COMPLETED_URL = API_BASE + "/workers/completed-complaints";
export const WORKER_LEADERBOARD_URL = API_BASE + "/workers/leaderboard";
export const UPDATE_COMPLAINT_STATUS_URL = (id) =>
  API_BASE + `/workers/complaint/${id}/status`;

// ============================================================================
// HOD URLs
// ============================================================================
export const HOD_URL = API_BASE + "/hod";
export const HOD_DASHBOARD_URL = API_BASE + "/hod/dashboard";
export const HOD_WORKERS_URL = API_BASE + "/hod/workers";
export const HOD_WORKER_COMPLAINTS_URL = (workerId) =>
  API_BASE + `/hod/workers/${workerId}/complaints`;
export const HOD_ASSIGN_COMPLAINT_URL = API_BASE + "/hod/assign-complaint";
export const HOD_APPROVE_COMPLETION_URL = (id) =>
  API_BASE + `/hod/approve-completion/${id}`;
export const HOD_NEEDS_REWORK_URL = (id) =>
  API_BASE + `/hod/needs-rework/${id}`;
export const HOD_CANCEL_COMPLAINT_URL = (id) =>
  API_BASE + `/hod/cancel-complaint/${id}`;
export const HOD_BULK_ASSIGN_URL = API_BASE + "/hod/bulk-assign";
export const HOD_INVITE_WORKER_URL = API_BASE + "/hod/invite-worker";
export const HOD_REMOVE_WORKER_URL = (workerId) =>
  API_BASE + `/hod/workers/${workerId}`;

// ============================================================================
// HEALTH CHECK
// ============================================================================
export const HEALTH_CHECK_URL = API_BASE + "/health";
