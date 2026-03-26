import { useMutation, useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import apiCall from "../api";
import { invalidateComplaintQueries } from "../invalidateComplaintQueries";
import {
  APPLY_AI_SUGGESTION_URL,
  HOD_APPROVE_COMPLETION_URL,
  HOD_CANCEL_COMPLAINT_URL,
  HOD_NEEDS_REWORK_URL,
  SATISFACTION_VOTE_URL,
  SUBMIT_FEEDBACK_URL,
  UPDATE_COMPLAINT_STATUS_URL,
  UPVOTE_COMPLAINT_URL,
} from "../../url";

function showToast(type, text1, text2) {
  Toast.show({ type, text1, text2 });
}

function useComplaintMutation({
  complaintId,
  t,
  mutationFn,
  includeAiReview = false,
  successToast,
  errorToast,
  onSuccess,
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      if (successToast) {
        const toast = successToast(data, variables);
        if (toast) showToast("success", toast.text1, toast.text2);
      }
      await invalidateComplaintQueries(queryClient, {
        complaintId,
        includeAiReview,
      });
      if (onSuccess) {
        await onSuccess(data, variables);
      }
    },
    onError: (error, variables) => {
      const toast = errorToast?.(error, variables) ?? {
        text1: t("common.failed"),
        text2: error?.response?.data?.message ?? t("common.tryAgain"),
      };
      showToast("error", toast.text1, toast.text2);
    },
  });
}

export function useComplaintCitizenActions({
  complaintId,
  t,
  hasUpvoted,
  onUpvoteSuccess,
  onFeedbackSuccess,
  onSatisfactionSuccess,
}) {
  const upvoteMutation = useComplaintMutation({
    complaintId,
    t,
    mutationFn: async () =>
      apiCall({
        method: "POST",
        url: UPVOTE_COMPLAINT_URL(complaintId),
      }),
    successToast: () => ({
      text1: hasUpvoted
        ? t("complaints.details.upvoteRemoved")
        : t("complaints.details.upvotedSuccess"),
      text2: hasUpvoted
        ? t("complaints.details.upvoteRemovedMessage")
        : t("complaints.details.thanksForUpvoting"),
    }),
    errorToast: (error) => ({
      text1: t("common.failed"),
      text2:
        error?.response?.data?.message || t("complaints.details.couldNotUpvote"),
    }),
    onSuccess: async (response) => {
      if (onUpvoteSuccess) {
        await onUpvoteSuccess(response?.data ?? null);
      }
    },
  });

  const feedbackMutation = useComplaintMutation({
    complaintId,
    t,
    mutationFn: async ({ rating, comment }) =>
      apiCall({
        method: "POST",
        url: SUBMIT_FEEDBACK_URL(complaintId),
        data: { rating, comment },
      }),
    successToast: () => ({
      text1: t("complaints.details.feedbackSubmitted"),
      text2: t("complaints.details.thankYouFeedback"),
    }),
    errorToast: (error) => ({
      text1: t("complaints.details.submissionFailed"),
      text2:
        error?.response?.data?.message ||
        t("complaints.details.couldNotSubmitFeedback"),
    }),
    onSuccess: async (_data) => {
      if (onFeedbackSuccess) await onFeedbackSuccess();
    },
  });

  const satisfactionMutation = useComplaintMutation({
    complaintId,
    t,
    mutationFn: async ({ voteType }) =>
      apiCall({
        method: "POST",
        url: SATISFACTION_VOTE_URL(complaintId),
        data: { voteType },
      }),
    successToast: (_data, variables) => ({
      text1: t("complaints.details.voteRecorded"),
      text2:
        variables?.voteType === "up"
          ? t("complaints.details.thanksForPositiveFeedback")
          : t("complaints.details.feedbackReceived"),
    }),
    errorToast: (error) => ({
      text1: t("complaints.details.voteFailed"),
      text2:
        error?.response?.data?.message ||
        t("complaints.details.couldNotRecordVote"),
    }),
    onSuccess: async (response) => {
      if (onSatisfactionSuccess) {
        await onSatisfactionSuccess(response?.data?.satisfactionVotes ?? null);
      }
    },
  });

  return {
    toggleUpvote: () => upvoteMutation.mutateAsync(),
    submitFeedback: ({ rating, comment }) =>
      feedbackMutation.mutateAsync({ rating, comment }),
    voteSatisfaction: (voteType) =>
      satisfactionMutation.mutateAsync({ voteType }),
    upvoting: upvoteMutation.isPending,
    submittingFeedback: feedbackMutation.isPending,
    votingInProgress: satisfactionMutation.isPending,
  };
}

export function useComplaintWorkerActions({
  complaintId,
  t,
  onStartWorkSuccess,
  onUploadSuccess,
}) {
  const startWorkMutation = useComplaintMutation({
    complaintId,
    t,
    mutationFn: async () =>
      apiCall({
        method: "PUT",
        url: UPDATE_COMPLAINT_STATUS_URL(complaintId),
        data: { status: "in-progress" },
      }),
    successToast: () => ({
      text1: t("complaints.details.statusUpdated"),
      text2: t("complaints.details.markedAs", {
        status: t("complaints.status.inProgress"),
      }),
    }),
    errorToast: (error) => ({
      text1: t("complaints.details.updateFailed"),
      text2:
        error?.response?.data?.message ||
        t("complaints.details.couldNotUpdateStatus"),
    }),
    onSuccess: async () => {
      if (onStartWorkSuccess) await onStartWorkSuccess();
    },
  });

  const uploadCompletionMutation = useComplaintMutation({
    complaintId,
    t,
    mutationFn: async ({ photos }) => {
      const formData = new FormData();
      photos.forEach((photo, index) => {
        const fileExtension = photo.uri.split(".").pop();
        formData.append("completionPhotos", {
          uri: photo.uri,
          type: `image/${fileExtension}`,
          name: `completion_${Date.now()}_${index}.${fileExtension}`,
        });
      });
      formData.append("status", "pending-approval");

      return apiCall({
        method: "PUT",
        url: UPDATE_COMPLAINT_STATUS_URL(complaintId),
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    successToast: () => ({
      text1: t("complaints.details.statusUpdated"),
      text2: t("complaints.details.markedAs", {
        status: t("complaints.status.pendingApproval"),
      }),
    }),
    errorToast: (error) => ({
      text1: t("complaints.details.updateFailed"),
      text2:
        error?.response?.data?.message ||
        t("complaints.details.couldNotUpdateStatus"),
    }),
    onSuccess: async () => {
      if (onUploadSuccess) await onUploadSuccess();
    },
  });

  return {
    startWork: () => startWorkMutation.mutateAsync(),
    uploadCompletionPhotos: (photos) =>
      uploadCompletionMutation.mutateAsync({ photos }),
    startingWork: startWorkMutation.isPending,
    uploadingPhotos: uploadCompletionMutation.isPending,
  };
}

export function useComplaintHodActions({
  complaintId,
  t,
  onApproveSuccess,
  onReworkSuccess,
  onCancelSuccess,
  onAiSuccess,
}) {
  const approveMutation = useComplaintMutation({
    complaintId,
    t,
    mutationFn: async ({ hodNotes }) =>
      apiCall({
        method: "POST",
        url: HOD_APPROVE_COMPLETION_URL(complaintId),
        data: { hodNotes },
      }),
    successToast: () => ({
      text1: t("complaints.details.approved"),
      text2: t("complaints.details.markedAsResolved"),
    }),
    errorToast: (error) => ({
      text1: t("complaints.details.approvalFailed"),
      text2:
        error?.response?.data?.message ||
        t("complaints.details.couldNotApprove"),
    }),
    onSuccess: async () => {
      if (onApproveSuccess) await onApproveSuccess();
    },
  });

  const reworkMutation = useComplaintMutation({
    complaintId,
    t,
    mutationFn: async ({ reworkReason }) =>
      apiCall({
        method: "POST",
        url: HOD_NEEDS_REWORK_URL(complaintId),
        data: { reworkReason },
      }),
    successToast: () => ({
      text1: t("complaints.details.sentForRework"),
      text2: t("complaints.details.workerNotified"),
    }),
    errorToast: (error) => ({
      text1: t("complaints.details.requestFailed"),
      text2:
        error?.response?.data?.message ||
        t("complaints.details.couldNotSendRework"),
    }),
    onSuccess: async () => {
      if (onReworkSuccess) await onReworkSuccess();
    },
  });

  const cancelMutation = useComplaintMutation({
    complaintId,
    t,
    mutationFn: async ({ reason }) =>
      apiCall({
        method: "POST",
        url: HOD_CANCEL_COMPLAINT_URL(complaintId),
        data: { reason },
      }),
    successToast: () => ({
      text1: t("complaints.details.cancelled"),
      text2: t("complaints.details.complaintCancelled"),
    }),
    errorToast: (error) => ({
      text1: t("complaints.details.cancelFailed"),
      text2:
        error?.response?.data?.message ||
        t("complaints.details.couldNotCancel"),
    }),
    onSuccess: async () => {
      if (onCancelSuccess) await onCancelSuccess();
    },
  });

  const aiMutation = useComplaintMutation({
    complaintId,
    t,
    includeAiReview: true,
    mutationFn: async ({ applyDepartment, applyPriority }) =>
      apiCall({
        method: "POST",
        url: APPLY_AI_SUGGESTION_URL(complaintId),
        data: { applyDepartment, applyPriority },
      }),
    successToast: () => ({
      text1: t("complaints.details.aiSuggestionApplied"),
      text2: t("complaints.details.complaintUpdated"),
    }),
    errorToast: (error) => ({
      text1: t("complaints.details.updateFailed"),
      text2:
        error?.response?.data?.message ||
        t("complaints.details.couldNotApplyAI"),
    }),
    onSuccess: async () => {
      if (onAiSuccess) await onAiSuccess();
    },
  });

  return {
    approveCompletion: (hodNotes = "Approved - Work completed satisfactorily") =>
      approveMutation.mutateAsync({ hodNotes }),
    sendForRework: (reworkReason) =>
      reworkMutation.mutateAsync({ reworkReason }),
    cancelComplaint: (reason) => cancelMutation.mutateAsync({ reason }),
    applyAiSuggestion: (applyDepartment, applyPriority) =>
      aiMutation.mutateAsync({ applyDepartment, applyPriority }),
    approving: approveMutation.isPending,
    sendingRework: reworkMutation.isPending,
    cancelling: cancelMutation.isPending,
    applyingAi: aiMutation.isPending,
  };
}
