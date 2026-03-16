import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";
import useApiMutation from "./useApiMutation";
import useApiQuery from "./useApiQuery";
import {
  HOD_INVITATIONS_URL,
  HOD_INVITE_WORKER_URL,
  HOD_REVOKE_INVITATION_URL,
} from "../../url";
import { queryKeys } from "../queryKeys";

export function useHodInvitations(t) {
  const queryClient = useQueryClient();

  const invitationsQuery = useApiQuery({
    queryKey: queryKeys.hodInvitations,
    url: HOD_INVITATIONS_URL,
    staleTime: 30 * 1000,
    retry: 1,
  });

  const inviteMutation = useApiMutation({ method: "POST" });
  const revokeMutation = useApiMutation({ method: "DELETE" });

  const refetchInvitations = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.hodInvitations });
    return invitationsQuery.refetch();
  };

  const sendInvitation = async (email) => {
    try {
      await inviteMutation.mutateAsync({
        urlOverride: HOD_INVITE_WORKER_URL,
        data: { email },
      });
      Toast.show({
        type: "success",
        text1: t("more.manageInvitations.toasts.sentTitle"),
        text2: t("more.manageInvitations.toasts.sentMessage", { email }),
      });
      await refetchInvitations();
      return true;
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("more.manageInvitations.toasts.sendFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("more.manageInvitations.toasts.sendFailedMessage"),
      });
      return false;
    }
  };

  const revokeInvitation = async (invitation) => {
    const targetId = invitation?.id ?? invitation?._id;
    if (!targetId) return false;

    try {
      await revokeMutation.mutateAsync({
        urlOverride: HOD_REVOKE_INVITATION_URL(targetId),
      });
      Toast.show({
        type: "success",
        text1: t("more.manageInvitations.toasts.revokedTitle"),
      });
      queryClient.setQueryData(queryKeys.hodInvitations, (previous) => {
        const nextData = Array.isArray(previous?.invitations)
          ? previous.invitations
          : Array.isArray(previous)
            ? previous
            : [];
        return {
          ...(previous || {}),
          invitations: nextData.map((item) =>
            (item.id ?? item._id) === targetId
              ? {
                  ...item,
                  status: "revoked",
                  revokedAt: new Date().toISOString(),
                }
              : item,
          ),
        };
      });
      await refetchInvitations();
      return true;
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("more.manageInvitations.toasts.revokeFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("more.manageInvitations.toasts.revokeFailedMessage"),
      });
      return false;
    }
  };

  return {
    invitations:
      invitationsQuery.data?.invitations ??
      invitationsQuery.data?.items ??
      [],
    isLoading: invitationsQuery.isLoading,
    isRefreshing: invitationsQuery.isRefetching,
    refetch: refetchInvitations,
    sendInvitation,
    revokeInvitation,
    sending: inviteMutation.isPending,
    revoking: revokeMutation.isPending,
  };
}
