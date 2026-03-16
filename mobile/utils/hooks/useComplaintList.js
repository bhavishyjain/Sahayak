import { useInfiniteQuery } from "@tanstack/react-query";
import apiCall from "../api";
import { GET_MY_COMPLAINTS_URL } from "../../url";
import { queryKeys } from "../queryKeys";

function buildComplaintParams({
  scope = "mine",
  status,
  excludeStatus,
  department,
  priority,
  sort = "new-to-old",
  startDate,
  endDate,
  search,
  limit = 10,
}) {
  const params = {
    scope,
    sort,
    limit,
  };

  if (status && status !== "all") params.status = status;
  if (excludeStatus) params.excludeStatus = excludeStatus;
  if (department && department !== "all") params.department = department;
  if (priority && priority !== "all") params.priority = priority;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (search?.trim()) params.search = search.trim();

  return params;
}

export default function useComplaintList({
  scope = "mine",
  status,
  excludeStatus,
  department,
  priority,
  sort = "new-to-old",
  startDate,
  endDate,
  search,
  limit = 10,
  enabled = true,
  staleTime = 30 * 1000,
}) {
  const baseParams = buildComplaintParams({
    scope,
    status,
    excludeStatus,
    department,
    priority,
    sort,
    startDate,
    endDate,
    search,
    limit,
  });

  const query = useInfiniteQuery({
    queryKey: queryKeys.complaintList(scope, baseParams),
    enabled,
    staleTime,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await apiCall({
        method: "GET",
        url: GET_MY_COMPLAINTS_URL,
        params: {
          ...baseParams,
          page: pageParam,
        },
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
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    refresh: query.refetch,
  };
}
