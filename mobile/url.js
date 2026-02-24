import { Platform } from "react-native";

// Base URL configuration
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:6000/api";
const BACKEND_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

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

// ============================================================================
// HOD URLs
// ============================================================================
export const HOD_URL = API_BASE + "/hod";

// ============================================================================
// HEALTH CHECK
// ============================================================================
export const HEALTH_CHECK_URL = API_BASE + "/health";
