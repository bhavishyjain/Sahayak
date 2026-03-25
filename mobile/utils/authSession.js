import apiCall from "./api";
import { registerPushToken } from "./pushToken";
import { setUserAuth } from "./userAuth";
import {
  GET_ANALYTICS_SUMMARY_URL,
  HOD_DASHBOARD_SUMMARY_URL,
  WORKER_DASHBOARD_SUMMARY_URL,
} from "../url";
import { queryKeys } from "./queryKeys";

export async function finalizeAuthenticatedSession(
  user,
  { queryClient } = {},
) {
  await setUserAuth(user);
  registerPushToken();

  if (!queryClient || !user?.role) return user;

  try {
    if (user.role === "user") {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.analyticsSummary,
        queryFn: async () => {
          const response = await apiCall({
            method: "GET",
            url: GET_ANALYTICS_SUMMARY_URL,
          });
          return response?.data;
        },
      });
    }

    if (user.role === "worker") {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.workerDashboardSummary,
        queryFn: async () => {
          const response = await apiCall({
            method: "GET",
            url: WORKER_DASHBOARD_SUMMARY_URL,
          });
          return response?.data;
        },
      });
    }

    if (user.role === "head") {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.hodDashboardSummary,
        queryFn: async () => {
          const response = await apiCall({
            method: "GET",
            url: HOD_DASHBOARD_SUMMARY_URL,
          });
          return response?.data;
        },
      });
    }
  } catch (_error) {
  }

  return user;
}
