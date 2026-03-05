import useApiMutation from "./useApiMutation";
import useApiQuery from "./useApiQuery";
import { REPORT_DOWNLOAD_URL, REPORT_STATS_URL } from "../../url";

function buildReportQueryString(filters = {}) {
  const params = new URLSearchParams();
  if (filters.department) params.append("department", filters.department);
  if (filters.status) params.append("status", filters.status);
  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useReportStats(filters, options = {}) {
  const querySuffix = buildReportQueryString(filters);
  return useApiQuery({
    queryKey: ["reports", "stats", filters],
    url: `${REPORT_STATS_URL}${querySuffix}`,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 60 * 1000,
    retry: options.retry ?? 1,
  });
}

export function useDownloadReport() {
  const mutation = useApiMutation({ method: "GET", url: REPORT_DOWNLOAD_URL("pdf") });

  const download = async ({ format, filters }) => {
    const suffix = buildReportQueryString(filters);
    return mutation.mutateAsync({
      urlOverride: `${REPORT_DOWNLOAD_URL(format)}${suffix}`,
      responseType: "arraybuffer",
    });
  };

  return {
    download,
    isPending: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export { buildReportQueryString };
