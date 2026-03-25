import { queryKeys } from "./queryKeys";

export async function invalidateComplaintQueries(
  queryClient,
  { complaintId, includeAiReview = false } = {},
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: queryKeys.complaintLists }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.workerDashboardSummary,
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.workerActivePreview,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.workerOverview }),
    queryClient.invalidateQueries({ queryKey: queryKeys.workerAssignedLists }),
    queryClient.invalidateQueries({ queryKey: queryKeys.hodDashboardSummary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.hodWorkersLists }),
    queryClient.invalidateQueries({ queryKey: ["heatmap"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.nearbyComplaints }),
    queryClient.invalidateQueries({ queryKey: queryKeys.aiReview }),
  ];

  if (complaintId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.complaintDetail(complaintId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.hodWorkerAssignment(complaintId),
      }),
    );
  }

  await Promise.all(invalidations);
}
