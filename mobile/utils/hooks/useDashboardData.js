import { useQuery } from "@tanstack/react-query";
import {
  GET_ANALYTICS_SUMMARY_URL,
  GET_HEATMAP_URL,
  HOD_DASHBOARD_SUMMARY_URL,
  WORKER_ACTIVE_PREVIEW_URL,
  WORKER_DASHBOARD_SUMMARY_URL,
} from "../../url";
import apiCall from "../api";
import { queryKeys } from "../queryKeys";

export const EMPTY_ANALYTICS_SUMMARY = {
  stats: { total: 0, pending: 0, inProgress: 0, resolved: 0 },
  avgResolutionTime: null,
  mostActiveDepartment: null,
  departmentBreakdown: [],
  monthlyTrend: [],
  recent: [],
};

function mapWorkerPreviewComplaint(c, t) {
  return {
    id: c._id,
    ticketId: c.ticketId,
    title:
      c.title ??
      c.rawText?.split(":")?.[0] ??
      t("worker.dashboard.complaintFallback"),
    description:
      c.description ??
      c.refinedText ??
      c.rawText ??
      t("worker.dashboard.complaintFallback"),
    priority: c.priority,
    status: c.status,
  };
}

function mapWorkerDashboardResponse({ statistics, complaints = [] }, t) {
  return {
    activeCount: statistics?.activeComplaints ?? 0,
    completedCount: statistics?.totalCompleted ?? 0,
    weekCompleted: statistics?.weekCompleted ?? 0,
    pendingApproval: statistics?.pendingApproval ?? 0,
    activeComplaints: complaints.map((c) => mapWorkerPreviewComplaint(c, t)),
  };
}

export function useCitizenHomeSummary() {
  const summaryQuery = useQuery({
    queryKey: queryKeys.analyticsSummary,
    queryFn: async () => {
      const response = await apiCall({
        method: "GET",
        url: GET_ANALYTICS_SUMMARY_URL,
      });
      return response?.data ?? EMPTY_ANALYTICS_SUMMARY;
    },
  });

  const heatmapQuery = useQuery({
    queryKey: queryKeys.heatmap({
      department: "all",
      priority: "all",
      timeframe: "30days",
      granularity: "complaint",
    }),
    queryFn: async () => {
      const response = await apiCall({
        method: "GET",
        url: GET_HEATMAP_URL,
      });
      return response?.data ?? { spots: [] };
    },
  });

  const summary = summaryQuery.data ?? EMPTY_ANALYTICS_SUMMARY;
  const heatmapSpots = heatmapQuery.data?.spots ?? [];

  return {
    summary,
    heatmapSpots,
    headlineMetrics: [
      { key: "total", value: summary.stats?.total ?? 0 },
      { key: "pending", value: summary.stats?.pending ?? 0 },
      { key: "inProgress", value: summary.stats?.inProgress ?? 0 },
      { key: "resolved", value: summary.stats?.resolved ?? 0 },
    ],
    emptyStateHint:
      heatmapSpots.length === 0 && (summary.stats?.total ?? 0) === 0
        ? "no-complaints"
        : null,
    isLoading: summaryQuery.isLoading || heatmapQuery.isLoading,
    isRefreshing: summaryQuery.isRefetching || heatmapQuery.isRefetching,
    error: summaryQuery.error ?? heatmapQuery.error,
    refetch: () => Promise.all([summaryQuery.refetch(), heatmapQuery.refetch()]),
  };
}

export function useWorkerDashboard(t) {
  return useQuery({
    queryKey: queryKeys.workerOverview,
    queryFn: async () => {
      const [summaryRes, previewRes] = await Promise.all([
        apiCall({
          method: "GET",
          url: WORKER_DASHBOARD_SUMMARY_URL,
        }),
        apiCall({
          method: "GET",
          url: `${WORKER_ACTIVE_PREVIEW_URL}?limit=5`,
        }),
      ]);

      const statistics = summaryRes?.data?.statistics ?? {};
      const previewComplaints = previewRes?.data?.complaints ?? [];

      const mapped = mapWorkerDashboardResponse(
        { statistics, complaints: previewComplaints },
        t,
      );
      return {
        ...mapped,
        headlineMetrics: [
          { key: "activeCount", value: mapped.activeCount },
          { key: "completedCount", value: mapped.completedCount },
          { key: "weekCompleted", value: mapped.weekCompleted },
          { key: "pendingApproval", value: mapped.pendingApproval },
        ],
        previewComplaints: mapped.activeComplaints,
        emptyStateHint:
          mapped.activeComplaints.length === 0 ? "no-active-complaints" : null,
      };
    },
  });
}

export function useHodDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.hodDashboardSummary,
    queryFn: async () => {
      const response = await apiCall({
        method: "GET",
        url: HOD_DASHBOARD_SUMMARY_URL,
      });
      const stats = response?.data?.stats ?? null;
      if (!stats) return null;
      return {
        ...stats,
        headlineMetrics: [
          { key: "total", value: stats.totalComplaints ?? 0 },
          { key: "active", value: stats.activeComplaints ?? 0 },
          { key: "resolved", value: stats.resolvedComplaints ?? 0 },
          { key: "workers", value: stats.totalWorkers ?? 0 },
        ],
      };
    },
  });
}
