import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import DialogBox from "../../../components/DialogBox";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import {
  DELETED_COMPLAINTS_URL,
  PURGE_COMPLAINT_URL,
  RESTORE_COMPLAINT_URL,
} from "../../../url";
import { useState } from "react";

export default function AdminRecycleBinScreen() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const queryClient = useQueryClient();
  const [actionDialog, setActionDialog] = useState(null);

  const { data, isRefetching, refetch } = useQuery({
    queryKey: ["admin-recycle-bin"],
    queryFn: async () => {
      const response = await apiCall({
        method: "GET",
        url: `${DELETED_COMPLAINTS_URL}?page=1&limit=50`,
      });
      return {
        complaints: response?.data?.complaints ?? [],
        total: Number(response?.data?.total ?? 0),
      };
    },
  });

  const invalidateRecycleBin = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-recycle-bin"] });
    queryClient.invalidateQueries({ queryKey: ["admin-dashboard-home"] });
  };

  const mutation = useMutation({
    mutationFn: async ({ complaintId, type }) => {
      return apiCall({
        method: type === "restore" ? "POST" : "DELETE",
        url:
          type === "restore"
            ? RESTORE_COMPLAINT_URL(complaintId)
            : PURGE_COMPLAINT_URL(complaintId),
      });
    },
    onSuccess: (_response, variables) => {
      invalidateRecycleBin();
      setActionDialog(null);
      Toast.show({
        type: "success",
        text1:
          variables.type === "restore"
            ? "Complaint restored"
            : "Complaint purged",
        text2:
          variables.type === "restore"
            ? "The complaint has been moved back to the active system."
            : "The complaint has been permanently removed.",
      });
    },
    onError: (error) => {
      Toast.show({
        type: "error",
        text1: "Recycle-bin action failed",
        text2: error?.response?.data?.message || "Please try again.",
      });
    },
  });

  const complaints = data?.complaints ?? [];

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title="Recycle Bin" hasBackButton={false} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {complaints.length === 0 ? (
          <View
            className="rounded-2xl p-5"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderColor: colors.border,
              borderWidth: 1,
            }}
          >
            <Text
              className="text-base font-semibold"
              style={{ color: colors.textPrimary }}
            >
              Recycle bin is empty
            </Text>
            <Text
              className="text-sm mt-2"
              style={{ color: colors.textSecondary }}
            >
              Soft-deleted complaints will appear here with restore and purge
              actions.
            </Text>
          </View>
        ) : (
          complaints.map((complaint) => (
            <View
              key={complaint._id}
              className="rounded-2xl p-4 mb-3"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.border,
                borderWidth: 1,
              }}
            >
              <Text
                className="text-base font-bold"
                style={{ color: colors.textPrimary }}
              >
                #{complaint.ticketId || "NA"}
              </Text>
              <Text
                className="text-sm mt-2"
                style={{ color: colors.textPrimary }}
              >
                {complaint.rawText || "No complaint text available"}
              </Text>
              <Text
                className="text-xs mt-2"
                style={{ color: colors.textSecondary }}
              >
                Department: {complaint.department || "Unknown"}
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors.textSecondary }}
              >
                Deleted at:{" "}
                {complaint.deletedAt
                  ? new Date(complaint.deletedAt).toLocaleString()
                  : "Unknown"}
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors.textSecondary }}
              >
                Owner:{" "}
                {complaint.owner?.fullName ||
                  complaint.owner?.username ||
                  "Unavailable"}{" "}
                • Reason: {complaint.deletedReason || "Soft-deleted by admin"}
              </Text>

              <View className="flex-row mt-4" style={{ gap: 12 }}>
                <PressableBlock
                  onPress={() =>
                    setActionDialog({ type: "restore", complaint })
                  }
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ backgroundColor: colors.success + "18" }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.success }}
                  >
                    Restore
                  </Text>
                </PressableBlock>
                <PressableBlock
                  onPress={() => setActionDialog({ type: "purge", complaint })}
                  className="flex-1 rounded-xl py-3 items-center"
                  style={{ backgroundColor: colors.danger + "18" }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.danger }}
                  >
                    Purge
                  </Text>
                </PressableBlock>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <DialogBox
        visible={Boolean(actionDialog)}
        onClose={() => setActionDialog(null)}
        title={
          actionDialog?.type === "restore"
            ? "Restore complaint"
            : "Purge complaint"
        }
        message={
          actionDialog?.type === "restore"
            ? "This will move the complaint back into the normal complaint workflow."
            : "This action is irreversible and permanently removes the complaint."
        }
        confirmText={actionDialog?.type === "restore" ? "Restore" : "Purge"}
        onConfirm={() =>
          actionDialog &&
          mutation.mutate({
            type: actionDialog.type,
            complaintId: actionDialog.complaint._id,
          })
        }
        onCancel={() => setActionDialog(null)}
        loading={mutation.isPending}
      />
    </View>
  );
}
