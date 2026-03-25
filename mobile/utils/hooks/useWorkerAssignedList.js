import { useInfiniteQuery } from "@tanstack/react-query";
import apiCall from "../api";
import { WORKER_ASSIGNED_URL } from "../../url";

function buildParams({
  search,
  startDate,
  endDate,
  priority,
  status,
  limit = 20,
}) {
  return {
    limit,
    search: search?.trim() || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    priority: priority && priority !== "all" ? priority : undefined,
    status: status && status !== "all" ? status : undefined,
  };
}

export function useWorkerAssignedList(filters = {}) {
  const baseParams = buildParams(filters);

  const query = useInfiniteQuery({
    queryKey: ["worker-assigned-list", baseParams],
    placeholderData: (previousData) => previousData,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await apiCall({
        method: "GET",
        url: WORKER_ASSIGNED_URL,
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
