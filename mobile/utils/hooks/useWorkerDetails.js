import { useQuery } from "@tanstack/react-query";
import apiCall from "../api";
import {
  HOD_WORKER_COMPLAINTS_URL,
  HOD_WORKER_DETAIL_URL,
  WORKER_FEEDBACK_URL,
} from "../../url";
import { queryKeys } from "../queryKeys";

export function useWorkerDetails(workerId) {
  return useQuery({
    queryKey: queryKeys.workerDetail(workerId),
    enabled: Boolean(workerId),
    queryFn: async () => {
      const [
        workerRes,
        activeComplaintsRes,
        completedComplaintsRes,
        feedbackRes,
      ] =
        await Promise.all([
          apiCall({
            method: "GET",
            url: HOD_WORKER_DETAIL_URL(workerId),
          }),
          apiCall({
            method: "GET",
            url: HOD_WORKER_COMPLAINTS_URL(workerId),
            params: { status: "active", limit: 100 },
          }),
          apiCall({
            method: "GET",
            url: HOD_WORKER_COMPLAINTS_URL(workerId),
            params: { status: "completed", limit: 100 },
          }),
          apiCall({
            method: "GET",
            url: WORKER_FEEDBACK_URL,
            params: { workerId },
          }),
        ]);

      const worker = workerRes?.data?.worker ?? null;
      const activeComplaints = activeComplaintsRes?.data?.complaints ?? [];
      const completedComplaints = completedComplaintsRes?.data?.complaints ?? [];
      const feedbackSummary = feedbackRes?.data?.summary ?? {
        averageRating: 0,
        totalFeedback: 0,
      };
      const activeTotal = Number(
        activeComplaintsRes?.data?.total ?? activeComplaints.length,
      );
      const completedTotal = Number(
        completedComplaintsRes?.data?.total ?? completedComplaints.length,
      );

      return {
        worker,
        activeComplaints,
        completedComplaints,
        feedbackSummary,
        summary: {
          activeCount:
            activeTotal ??
            worker?.activeComplaints ??
            worker?.metrics?.activeComplaints ??
            0,
          completedCount:
            completedTotal ??
            worker?.completedCount ??
            worker?.metrics?.completedCount ??
            worker?.performanceMetrics?.totalCompleted ??
            0,
        },
      };
    },
  });
}
