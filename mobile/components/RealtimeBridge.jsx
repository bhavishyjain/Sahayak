import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";
import { markAccountDeactivated } from "../utils/accountStatus";
import { invalidateComplaintQueries } from "../utils/invalidateComplaintQueries";
import { prependRealtimeNotification } from "../utils/notificationsCache";
import { queryKeys } from "../utils/queryKeys";
import getUserAuth from "../utils/userAuth";
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
          includeAiReview: true,
        }).catch(() => {});
      },
    );
    const unsubscribeQueueUpdated = addRealtimeListener(
      "queue-updated",
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.aiReview });
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
    const unsubscribeReportSchedules = addRealtimeListener(
      "report-schedule-updated",
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.reportSchedules() });
      },
    );
    const unsubscribeAdminUpdated = addRealtimeListener(
      "admin-updated",
      async (payload) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.adminRecycleBin });
        queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboardHome });

        if (payload?.event !== "user-deactivated" || !payload?.userId) {
          return;
        }

        const currentUser = await getUserAuth();
        const currentUserId = String(
          currentUser?._id || currentUser?.id || currentUser?.userId || "",
        );

        if (currentUserId && currentUserId === String(payload.userId)) {
          await markAccountDeactivated();
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
      unsubscribeQueueUpdated();
      unsubscribeNotification();
      unsubscribeReportSchedules();
      unsubscribeAdminUpdated();
      appStateSubscription.remove();
    };
  }, [queryClient]);

  return null;
}
