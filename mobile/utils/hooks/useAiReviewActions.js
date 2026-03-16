import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import useApiMutation from "./useApiMutation";
import { invalidateComplaintQueries } from "../invalidateComplaintQueries";
import { APPLY_AI_SUGGESTION_URL } from "../../url";

export function useAiReviewActions(t) {
  const queryClient = useQueryClient();
  const mutation = useApiMutation();

  const applySuggestion = async ({
    complaintId,
    applyDepartment,
    applyPriority,
    silentSuccess = false,
  }) => {
    await mutation.mutateAsync({
      urlOverride: APPLY_AI_SUGGESTION_URL(complaintId),
      data: { applyDepartment, applyPriority },
    });
    await invalidateComplaintQueries(queryClient, {
      complaintId,
      includeAiReview: true,
    });
    if (!silentSuccess) {
      Toast.show({
        type: "success",
        text1: t("hod.aiReview.toasts.applySuccessTitle"),
      });
    }
  };

  return {
    applySuggestion,
    isPending: mutation.isPending,
  };
}
