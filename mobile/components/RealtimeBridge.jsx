import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { invalidateComplaintQueries } from "../utils/invalidateComplaintQueries";
import { prependRealtimeNotification } from "../utils/notificationsCache";
import {
  addRealtimeListener,
  ensureRealtimeConnection,
} from "../utils/realtime/socket";

export default function RealtimeBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    ensureRealtimeConnection().catch(() => {});

    const unsubscribeComplaintUpdated = addRealtimeListener(
      "complaint-updated",
      (payload) => {
        invalidateComplaintQueries(queryClient, {
          complaintId: payload?.complaintId,
          includeAiReview: payload?.event === "ai-suggestion-applied",
        }).catch(() => {});
      },
    );
    const unsubscribeNotification = addRealtimeListener(
      "notification",
      (payload) => {
        if (payload?.notification) {
          prependRealtimeNotification(queryClient, payload.notification);
        }
      },
    );

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        ensureRealtimeConnection().catch(() => {});
      }
    });

    return () => {
      unsubscribeComplaintUpdated();
      unsubscribeNotification();
      appStateSubscription.remove();
    };
  }, [queryClient]);

  return null;
}
