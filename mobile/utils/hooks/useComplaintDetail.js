import { useQuery } from "@tanstack/react-query";
import { GET_COMPLAINT_BY_ID_URL } from "../../url";
import apiCall from "../api";
import { cacheComplaintDetail } from "../complaintsCache";
import { mapComplaintDetailViewModel } from "../complaintDetailViewModel";
import { queryKeys } from "../queryKeys";
import getUserAuth from "../userAuth";

export function useComplaintDetail(complaintId) {
  return useQuery({
    queryKey: queryKeys.complaintDetail(complaintId),
    enabled: Boolean(complaintId),
    staleTime: 15 * 1000,
    retry: 1,
    queryFn: async () => {
      const [response, user] = await Promise.all([
        apiCall({
          method: "GET",
          url: GET_COMPLAINT_BY_ID_URL(complaintId),
        }),
        getUserAuth(),
      ]);

      const complaint = mapComplaintDetailViewModel(
        response?.data?.complaint ?? null,
      );
      if (complaint) {
        await cacheComplaintDetail(complaintId, complaint);
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
