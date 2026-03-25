import { useQuery } from "@tanstack/react-query";
import apiCall from "../api";
import {
  HOD_WORKER_COMPLAINTS_URL,
  HOD_WORKER_DETAIL_URL,
} from "../../url";
import { queryKeys } from "../queryKeys";

export function useWorkerDetails(workerId) {
  return useQuery({
    queryKey: queryKeys.workerDetail(workerId),
    enabled: Boolean(workerId),
    queryFn: async () => {
      const [workerRes, activeComplaintsRes, completedComplaintsRes] =
        await Promise.all([
          apiCall({
            method: "GET",
            url: HOD_WORKER_DETAIL_URL(workerId),
          }),
          apiCall({
            method: "GET",
            url: HOD_WORKER_COMPLAINTS_URL(workerId),
            params: { status: "active" },
          }),
          apiCall({
            method: "GET",
            url: HOD_WORKER_COMPLAINTS_URL(workerId),
            params: { status: "completed" },
          }),
        ]);

      const worker = workerRes?.data?.worker ?? null;
      const activeComplaints = activeComplaintsRes?.data?.complaints ?? [];
      const completedComplaints = completedComplaintsRes?.data?.complaints ?? [];

      return {
        worker,
        activeComplaints,
        completedComplaints,
        summary: {
          activeCount:
            worker?.activeComplaints ??
            worker?.metrics?.activeComplaints ??
            activeComplaints.length,
          completedCount:
            worker?.completedCount ??
            worker?.metrics?.completedCount ??
            worker?.performanceMetrics?.totalCompleted ??
            0,
        },
      };
    },
  });
}
