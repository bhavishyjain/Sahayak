import { useInfiniteQuery } from "@tanstack/react-query";
import apiCall from "../api";
import { HOD_WORKERS_URL } from "../../url";

export function useHodWorkersList({ search = "", limit = 20 } = {}) {
  const trimmedSearch = search.trim();
  const query = useInfiniteQuery({
    queryKey: ["hod-workers-list", { search: trimmedSearch, limit }],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await apiCall({
        method: "GET",
        url: HOD_WORKERS_URL,
        params: {
          page: pageParam,
          limit,
          search: trimmedSearch || undefined,
        },
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
    workers: pages.flatMap((page) => page?.workers ?? []),
    total: Number(
      pages[0]?.total ?? pages[0]?.pagination?.total ?? 0,
    ),
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
    refresh: query.refetch,
  };
}
