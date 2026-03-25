import { useMemo } from "react";
import { useDepartmentBreakdown, useReportStats } from "./useReports";

function normalizeFilters(filters = {}) {
  const normalized = {};
  if (filters.department && filters.department !== "all") {
    normalized.department = filters.department;
  }
  if (filters.status && filters.status !== "all") {
    normalized.status = filters.status;
  }
  if (filters.startDate) normalized.startDate = filters.startDate;
  if (filters.endDate) normalized.endDate = filters.endDate;
  return normalized;
}

export function useHodReportsDashboard(appliedFilters) {
  const normalizedFilters = useMemo(
    () => normalizeFilters(appliedFilters),
    [appliedFilters],
  );

  const statsQuery = useReportStats(normalizedFilters);
  const breakdownQuery = useDepartmentBreakdown(normalizedFilters);

  const stats = statsQuery.data?.stats ?? statsQuery.data?.statistics ?? null;
  const breakdownItems =
    breakdownQuery.data?.items ??
    breakdownQuery.data?.departments ??
    breakdownQuery.data?.breakdown ??
    [];

  return {
    normalizedFilters,
    stats,
    breakdownItems,
    isLoading: statsQuery.isLoading || breakdownQuery.isLoading,
    isRefreshing: statsQuery.isRefetching || breakdownQuery.isRefetching,
    error: statsQuery.error ?? breakdownQuery.error,
    refetch: () => Promise.all([statsQuery.refetch(), breakdownQuery.refetch()]),
  };
}
