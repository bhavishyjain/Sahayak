import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import apiCall from "../api";
import { GET_NEARBY_COMPLAINTS_URL, UPVOTE_COMPLAINT_URL } from "../../url";

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
    complaints: response?.data?.complaints ?? [],
    permissionDenied: false,
  };
}

export function useNearbyComplaints() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["nearby-complaints"],
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
      queryClient.setQueryData(["nearby-complaints"], (previous) => ({
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
  };
}
