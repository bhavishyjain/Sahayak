import useApiQuery from "./useApiQuery";
import { WORKER_ANALYTICS_URL } from "../../url";
import { queryKeys } from "../queryKeys";

export function useWorkerAnalytics(workerId = "") {
  const url = workerId
    ? `${WORKER_ANALYTICS_URL}?workerId=${workerId}`
    : WORKER_ANALYTICS_URL;

  return useApiQuery({
    queryKey: queryKeys.workerAnalytics(workerId),
    url,
    staleTime: 60 * 1000,
    retry: 1,
  });
}
