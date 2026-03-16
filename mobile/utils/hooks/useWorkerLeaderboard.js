import useApiQuery from "./useApiQuery";
import { WORKER_LEADERBOARD_URL } from "../../url";
import { queryKeys } from "../queryKeys";

export function useWorkerLeaderboard(period = "weekly") {
  return useApiQuery({
    queryKey: queryKeys.workerLeaderboard(period),
    url: `${WORKER_LEADERBOARD_URL}?period=${period}`,
    staleTime: 60 * 1000,
    retry: 1,
  });
}
