import { useInfiniteQuery } from "@tanstack/react-query";
import apiCall from "../api";
import { WORKER_COMPLETED_URL } from "../../url";
import { queryKeys } from "../queryKeys";

function buildParams({ search, startDate, endDate, limit = 20 }) {
  return {
    limit,
    search: search?.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };
}

export function useWorkerCompletedList(filters = {}) {
  const baseParams = buildParams(filters);

  const query = useInfiniteQuery({
    queryKey: queryKeys.workerCompletedFeed(baseParams),
    placeholderData: (previousData) => previousData,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await apiCall({
        method: "GET",
        url: WORKER_COMPLETED_URL,
        params: { ...baseParams, page: pageParam },
      });
      return response?.data ?? {};
    },
    getNextPageParam: (lastPage) => {
      const page = Number(lastPage?.page ?? 1);
      const pages = Number(lastPage?.pages ?? 1);
      return page < pages ? page + 1 : undefined;
    },
  });

  const pages = query.data?.pages ?? [];
  return {
    ...query,
    complaints: pages.flatMap((page) => page?.complaints ?? []),
    total: Number(pages[0]?.total ?? 0),
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
    refresh: query.refetch,
  };
}
