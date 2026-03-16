import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import useApiMutation from "./useApiMutation";
import useApiQuery from "./useApiQuery";
import {
  REPORT_CANCEL_SCHEDULE_URL,
  REPORT_RUN_NOW_URL,
  REPORT_SCHEDULES_URL,
  REPORT_SCHEDULE_URL,
} from "../../url";
import { queryKeys } from "../queryKeys";

export function useReportSchedules(t) {
  const queryClient = useQueryClient();
  const schedulesQuery = useApiQuery({
    queryKey: queryKeys.reportSchedules(),
    url: REPORT_SCHEDULES_URL,
    staleTime: 30 * 1000,
    retry: 1,
  });
  const createMutation = useApiMutation({ method: "POST" });
  const cancelMutation = useApiMutation({ method: "DELETE" });
  const runNowMutation = useApiMutation({ method: "POST" });

  const refetchSchedules = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.reportSchedules() });
    return schedulesQuery.refetch();
  };

  const createSchedule = async (data, frequencyLabel) => {
    try {
      await createMutation.mutateAsync({
        urlOverride: REPORT_SCHEDULE_URL,
        data,
      });
      Toast.show({
        type: "success",
        text1: t("reports.schedule.scheduledTitle"),
        text2: t("reports.schedule.scheduledMessage", {
          frequency: frequencyLabel,
          email: data.email,
        }),
      });
      await refetchSchedules();
      return true;
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2:
          error?.response?.data?.message ?? t("reports.schedule.scheduleFailed"),
      });
      return false;
    }
  };

  const cancelSchedule = async (scheduleId) => {
    try {
      await cancelMutation.mutateAsync({
        urlOverride: REPORT_CANCEL_SCHEDULE_URL(scheduleId),
      });
      Toast.show({
        type: "success",
        text1: t("reports.schedule.cancelledTitle"),
      });
      await refetchSchedules();
      return true;
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2:
          error?.response?.data?.message ?? t("reports.schedule.cancelFailed"),
      });
      return false;
    }
  };

  const runScheduleNow = async (scheduleId) => {
    try {
      const response = await runNowMutation.mutateAsync({
        urlOverride: REPORT_RUN_NOW_URL(scheduleId),
      });
      const updatedSchedule = response?.schedule ?? null;
      queryClient.setQueryData(queryKeys.reportSchedules(), (previous) => {
        const schedules = previous?.schedules ?? previous?.items ?? [];
        return {
          ...(previous || {}),
          items: schedules.map((item) =>
            item._id === scheduleId ? updatedSchedule : item,
          ),
          schedules: schedules.map((item) =>
            item._id === scheduleId ? updatedSchedule : item,
          ),
        };
      });
      Toast.show({
        type: "success",
        text1: t("reports.schedule.runNowSuccessTitle"),
        text2: t("reports.schedule.runNowSuccessMessage"),
      });
      return true;
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2:
          error?.response?.data?.message ?? t("reports.schedule.runNowFailed"),
      });
      await refetchSchedules();
      return false;
    }
  };

  return {
    schedules:
      schedulesQuery.data?.schedules ??
      schedulesQuery.data?.items ??
      [],
    isLoading: schedulesQuery.isLoading,
    isRefreshing: schedulesQuery.isRefetching,
    refetch: refetchSchedules,
    createSchedule,
    cancelSchedule,
    runScheduleNow,
    scheduling: createMutation.isPending,
    cancellingId: cancelMutation.variables?.urlOverride
      ? String(cancelMutation.variables.urlOverride).split("/").slice(-1)[0]
      : null,
    runningNowId: runNowMutation.variables?.urlOverride
      ? String(runNowMutation.variables.urlOverride).split("/").slice(-2, -1)[0]
      : null,
  };
}
