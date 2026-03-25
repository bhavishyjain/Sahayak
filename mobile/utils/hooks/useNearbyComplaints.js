import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import apiCall from "../api";
import { GET_NEARBY_COMPLAINTS_URL, UPVOTE_COMPLAINT_URL } from "../../url";
import { queryKeys } from "../queryKeys";

async function fetchNearbyComplaints() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    return { complaints: [], permissionDenied: true };
  }

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const response = await apiCall({
    method: "GET",
    url: `${GET_NEARBY_COMPLAINTS_URL}?lat=${loc.coords.latitude}&lng=${loc.coords.longitude}&radius=5`,
  });
  return {
    complaints: (response?.data?.complaints ?? []).slice().sort((a, b) => {
      const distanceA = Number(a?.distance ?? Number.MAX_SAFE_INTEGER);
      const distanceB = Number(b?.distance ?? Number.MAX_SAFE_INTEGER);
      return distanceA - distanceB || Number(b?.upvoteCount || 0) - Number(a?.upvoteCount || 0);
    }),
    permissionDenied: false,
  };
}

export function useNearbyComplaints() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.nearbyComplaints,
    queryFn: fetchNearbyComplaints,
  });

  const upvoteMutation = useMutation({
    mutationFn: async (complaintId) => {
      const response = await apiCall({
        method: "POST",
        url: UPVOTE_COMPLAINT_URL(complaintId),
      });
      return { complaintId, ...(response?.data ?? {}) };
    },
    onSuccess: ({ complaintId, upvoteCount, hasUpvoted }) => {
      queryClient.setQueryData(queryKeys.nearbyComplaints, (previous) => ({
        ...(previous || {}),
        complaints: (previous?.complaints ?? []).map((complaint) =>
          complaint._id === complaintId
            ? {
                ...complaint,
                upvoteCount: upvoteCount ?? complaint.upvoteCount,
                hasUpvoted:
                  typeof hasUpvoted === "boolean"
                    ? hasUpvoted
                    : complaint.hasUpvoted,
              }
            : complaint,
        ),
      }));
    },
  });

  return {
    ...query,
    complaints: query.data?.complaints ?? [],
    permissionDenied: Boolean(query.data?.permissionDenied),
    upvoteComplaint: upvoteMutation.mutateAsync,
    isUpvoting: upvoteMutation.isPending,
    isRefreshing: query.isFetching,
  };
}
