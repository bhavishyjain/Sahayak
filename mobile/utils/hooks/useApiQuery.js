import { useQuery } from "@tanstack/react-query";
import apiCall from "../api";

export default function useApiQuery({
  queryKey,
  method = "GET",
  url,
  params,
  enabled = true,
  staleTime = 30 * 1000,
  retry = 1,
  select,
}) {
  return useQuery({
    queryKey,
    enabled,
    staleTime,
    retry,
    queryFn: async () => {
      const response = await apiCall({
        method,
        url,
        params,
      });
      return response?.data;
    },
    select,
  });
}
