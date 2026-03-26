import { useInfiniteQuery } from "@tanstack/react-query";
import apiCall from "../api";
import { HOD_OVERVIEW_URL } from "../../url";
import { queryKeys } from "../queryKeys";

function buildParams({
  search,
  priority,
  sort = "new-to-old",
  startDate,
  endDate,
  status,
  limit = 20,
}) {
  return {
    bucket: "open",
    sort,
    limit,
    search: search?.trim() || undefined,
    priority: priority && priority !== "all" ? priority : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    status:
      status && status !== "all" && status !== "resolved"
        ? status
        : undefined,
  };
}

export function useHodComplaintFeed(filters = {}) {
  const baseParams = buildParams(filters);
  const query = useInfiniteQuery({
    queryKey: queryKeys.hodComplaintFeed(baseParams),
    placeholderData: (previousData) => previousData,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await apiCall({
        method: "GET",
        url: HOD_OVERVIEW_URL,
        params: { ...baseParams, page: pageParam },
      });
      return response?.data ?? {};
    },
    getNextPageParam: (lastPage) => {
      const page = Number(lastPage?.page ?? lastPage?.pagination?.page ?? 1);
      const totalPages = Number(
        lastPage?.totalPages ?? lastPage?.pagination?.totalPages ?? 1,
      );
      return page < totalPages ? page + 1 : undefined;
    },
  });
  const pages = query.data?.pages ?? [];
  return {
    ...query,
    complaints: pages
      .flatMap((page) => page?.complaints ?? [])
      .filter((complaint) => complaint?.status !== "resolved"),
    total: Number(pages[0]?.total ?? pages[0]?.pagination?.total ?? 0),
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
    refresh: query.refetch,
  };
}
