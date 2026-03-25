import { useQuery } from "@tanstack/react-query";
import { GET_COMPLAINT_BY_ID_URL } from "../../url";
import apiCall from "../api";
import { cacheComplaintDetail } from "../complaintsCache";
import { mapComplaintDetailViewModel } from "../complaintDetailViewModel";
import { queryKeys } from "../queryKeys";
import getUserAuth from "../userAuth";

export function useComplaintDetail(complaintId) {
  const normalizedComplaintId = Array.isArray(complaintId)
    ? String(complaintId[0] || "").trim()
    : String(complaintId || "").trim();

  return useQuery({
    queryKey: queryKeys.complaintDetail(normalizedComplaintId),
    enabled: Boolean(normalizedComplaintId),
    staleTime: 15 * 1000,
    retry: 1,
    queryFn: async () => {
      const [response, user] = await Promise.all([
        apiCall({
          method: "GET",
          url: GET_COMPLAINT_BY_ID_URL(normalizedComplaintId),
        }),
        getUserAuth(),
      ]);

      const complaint = mapComplaintDetailViewModel(
        response?.data?.complaint ?? null,
      );
      if (complaint) {
        await cacheComplaintDetail(normalizedComplaintId, complaint);
      }

      return {
        complaint,
        userRole: user?.role ?? null,
        currentUserId: String(user?.id || user?._id || ""),
        fromCache: false,
      };
    },
  });
}
