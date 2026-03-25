import { router } from "expo-router";

const NOTIFICATION_ROUTE_SCREENS = Object.freeze({
  COMPLAINT_DETAIL: "complaint-detail",
  COMPLAINT_CHAT: "complaint-chat",
  AI_REVIEW: "ai-review",
  WORKER_ASSIGNMENT: "worker-assignment",
});

function normalizeParams(params = {}) {
  return Object.entries(params).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === "") return acc;
    acc[key] = String(value);
    return acc;
  }, {});
}

export function getNotificationRoute(data = {}) {
  const explicitScreen = data?.route?.screen;
  const explicitParams = normalizeParams(data?.route?.params || data?.route || {});
  const complaintId = String(data?.complaintId || explicitParams.complaintId || "");
  const ticketId = String(data?.ticketId || explicitParams.ticketId || "");
  const type = String(data?.type || "").trim();

  if (explicitScreen) {
    return {
      screen: explicitScreen,
      params: explicitParams,
    };
  }

  if (type === "chat-message" && complaintId) {
    return {
      screen: NOTIFICATION_ROUTE_SCREENS.COMPLAINT_CHAT,
      params: normalizeParams({ complaintId, ticketId }),
    };
  }

  if (complaintId) {
    return {
      screen: NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL,
      params: normalizeParams({ complaintId, ticketId }),
    };
  }

  return null;
}

export function openNotificationRoute(data = {}, navigation = router) {
  const route = getNotificationRoute(data);
  if (!route?.screen) return false;

  switch (route.screen) {
    case NOTIFICATION_ROUTE_SCREENS.COMPLAINT_DETAIL:
      if (!route.params?.complaintId) return false;
      navigation.push({
        pathname: "/(app)/complaints/complaint-details",
        params: { id: route.params.complaintId },
      });
      return true;
    case NOTIFICATION_ROUTE_SCREENS.COMPLAINT_CHAT:
      if (!route.params?.complaintId) return false;
      navigation.push({
        pathname: "/(app)/complaints/complaint-chat",
        params: {
          id: route.params.complaintId,
          ticketId: route.params.ticketId,
        },
      });
      return true;
    case NOTIFICATION_ROUTE_SCREENS.AI_REVIEW:
      navigation.push({
        pathname: "/hod/ai-review",
      });
      return true;
    case NOTIFICATION_ROUTE_SCREENS.WORKER_ASSIGNMENT:
      if (!route.params?.complaintId) return false;
      navigation.push({
        pathname: "/hod/worker-assignment",
        params: { complaintId: route.params.complaintId },
      });
      return true;
    default:
      return false;
  }
}

export { NOTIFICATION_ROUTE_SCREENS };
