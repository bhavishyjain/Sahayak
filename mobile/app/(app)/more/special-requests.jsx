import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import DialogBox from "../../../components/DialogBox";
import FilterPanel from "../../../components/FilterPanel";
import PressableBlock from "../../../components/PressableBlock";
import { formatStatusLabel } from "../../../data/complaintStatus";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";
import {
  ADMIN_REVIEW_SPECIAL_REQUEST_URL,
  ADMIN_SPECIAL_REQUESTS_URL,
  HOD_SPECIAL_REQUESTS_URL,
} from "../../../url";
import useRealtimeRefresh from "../../../utils/realtime/useRealtimeRefresh";

function RequestCard({
  item,
  colors,
  mode,
  onApprove,
  onReject,
  onOpen,
  t,
}) {
  const statusTone =
    item.status === "approved"
      ? colors.success
      : item.status === "rejected"
        ? colors.danger
        : colors.warning;

  return (
    <View
      className="rounded-xl p-4 mb-3"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <PressableBlock onPress={onOpen}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.textPrimary }}
            >
              {item.ticketId}
            </Text>
            <Text
              className="text-xs mt-1"
              style={{ color: colors.textSecondary }}
            >
              {item.requestType === "delete"
                ? t("more.specialRequestsScreen.card.deleteRequest")
                : t("more.specialRequestsScreen.card.editRequest")}
            </Text>
            {item.requestType === "update" ? (
              <Text
                className="text-xs mt-2"
                style={{ color: colors.textSecondary }}
              >
                {[
                  item.currentDepartment !== item.requestedDepartment
                    ? t("more.specialRequestsScreen.card.departmentChange", {
                        from: item.currentDepartment,
                        to: item.requestedDepartment,
                      })
                    : null,
                  item.currentPriority !== item.requestedPriority
                    ? t("more.specialRequestsScreen.card.priorityChange", {
                        from: item.currentPriority,
                        to: item.requestedPriority,
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(t("more.specialRequestsScreen.card.changeSeparator"))}
              </Text>
            ) : null}
            {item.reason ? (
              <Text
                className="text-xs mt-2"
                style={{ color: colors.textSecondary }}
              >
                {item.reason}
              </Text>
            ) : null}
            {item.requestedBy?.fullName || item.requestedBy?.username ? (
              <Text
                className="text-xs mt-2"
                style={{ color: colors.textSecondary }}
              >
                {t("more.specialRequestsScreen.card.requestedBy", {
                  name: item.requestedBy.fullName || item.requestedBy.username,
                })}
              </Text>
            ) : null}
            <Text
              className="text-xs mt-3 font-semibold"
              style={{ color: colors.primary }}
            >
              {t("more.specialRequestsScreen.card.openComplaint")}
            </Text>
          </View>
          <View
            className="px-2.5 py-1 rounded-full"
            style={{ backgroundColor: statusTone + "18" }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: statusTone }}
            >
              {formatStatusLabel(t, item.status)}
            </Text>
          </View>
        </View>
      </PressableBlock>

      {mode === "admin" && item.status === "pending" ? (
        <View className="flex-row mt-4" style={{ gap: 10 }}>
          <PressableBlock
            onPress={onApprove}
            className="flex-1 rounded-xl py-3 items-center"
            style={{ backgroundColor: colors.success }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.light }}
            >
              {t("more.specialRequestsScreen.actions.approve")}
            </Text>
          </PressableBlock>
          <PressableBlock
            onPress={onReject}
            className="flex-1 rounded-xl py-3 items-center"
            style={{ backgroundColor: colors.danger }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.light }}
            >
              {t("more.specialRequestsScreen.actions.reject")}
            </Text>
          </PressableBlock>
        </View>
      ) : null}
    </View>
  );
}

export default function SpecialRequestsScreen() {
  const { colorScheme } = useTheme();
  const { t } = useTranslation();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const [mode, setMode] = useState("admin");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewState, setReviewState] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [requestStartDate, setRequestStartDate] = useState("");
  const [requestEndDate, setRequestEndDate] = useState("");

  const loadRequests = async () => {
    try {
      setLoading(true);
      const user = await getUserAuth();
      const nextMode = user?.role === "head" ? "hod" : "admin";
      setMode(nextMode);
      const response = await apiCall({
        method: "GET",
        url:
          nextMode === "admin"
            ? `${ADMIN_SPECIAL_REQUESTS_URL}?status=all`
            : HOD_SPECIAL_REQUESTS_URL,
      });
      setRequests(Array.isArray(response?.data) ? response.data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useRealtimeRefresh("queue-updated", () => {
    loadRequests();
  });

  const filteredRequests = useMemo(
    () =>
      requests.filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) {
          return false;
        }

        const createdAt = item.createdAt ? new Date(item.createdAt) : null;
        if (!createdAt || Number.isNaN(createdAt.getTime())) {
          return !requestStartDate && !requestEndDate;
        }

        if (requestStartDate) {
          const start = new Date(`${requestStartDate}T00:00:00`);
          if (createdAt < start) return false;
        }

        if (requestEndDate) {
          const end = new Date(`${requestEndDate}T23:59:59.999`);
          if (createdAt > end) return false;
        }

        return true;
      }),
    [requestEndDate, requestStartDate, requests, statusFilter],
  );
  const hasActiveFilters =
    statusFilter !== "all" || Boolean(requestStartDate || requestEndDate);
  const filterSummary = [
    statusFilter !== "all"
      ? statusFilter === "all"
        ? t("common.all")
        : formatStatusLabel(t, statusFilter)
      : null,
    requestStartDate
      ? t("more.specialRequestsScreen.filters.fromDate", {
          date: requestStartDate,
        })
      : null,
    requestEndDate
      ? t("more.specialRequestsScreen.filters.toDate", {
          date: requestEndDate,
        })
      : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const handleReview = async () => {
    if (!reviewState?.request) return;

    try {
      setSubmitting(true);
      await apiCall({
        method: "POST",
        url: ADMIN_REVIEW_SPECIAL_REQUEST_URL(reviewState.request.id),
        data: {
          decision: reviewState.decision,
          reviewNote: reviewNote.trim(),
        },
      });
      Toast.show({
        type: "success",
        text1:
          reviewState.decision === "approve"
            ? t("more.specialRequestsScreen.toasts.requestApproved")
            : t("more.specialRequestsScreen.toasts.requestRejected"),
      });
      setReviewState(null);
      setReviewNote("");
      await loadRequests();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("more.specialRequestsScreen.toasts.reviewFailedTitle"),
        text2:
          error?.response?.data?.message ||
          t("more.specialRequestsScreen.toasts.reviewFailedMessage"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("more.specialRequestsScreen.title")} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <FilterPanel
          variant="bar"
          summary={filterSummary}
          statusOptions={["pending", "approved", "rejected"]}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          startDate={requestStartDate}
          endDate={requestEndDate}
          setStartDate={setRequestStartDate}
          setEndDate={setRequestEndDate}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => {}}
          t={t}
          formatPriorityLabel={() => ""}
          style={{ marginBottom: 16 }}
        />

        {loading ? (
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {t("more.specialRequestsScreen.loading")}
          </Text>
        ) : filteredRequests.length === 0 ? (
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {statusFilter === "all"
              ? t("more.specialRequestsScreen.emptyAll")
              : t("more.specialRequestsScreen.emptyForStatus", {
                  status: formatStatusLabel(t, statusFilter),
                })}
          </Text>
        ) : (
          filteredRequests.map((item) => (
            <RequestCard
              key={item.id}
              item={item}
              colors={colors}
              mode={mode}
              t={t}
              onApprove={() =>
                setReviewState({ request: item, decision: "approve" })
              }
              onReject={() =>
                setReviewState({ request: item, decision: "reject" })
              }
              onOpen={() =>
                router.push({
                  pathname: "/(app)/complaints/complaint-details",
                  params: { id: item.complaintId },
                })
              }
            />
          ))
        )}
      </ScrollView>

      <DialogBox
        visible={mode === "admin" && Boolean(reviewState)}
        onClose={() => setReviewState(null)}
        title={
          reviewState?.decision === "approve"
            ? t("more.specialRequestsScreen.dialog.approveTitle")
            : t("more.specialRequestsScreen.dialog.rejectTitle")
        }
        message={
          reviewState?.decision === "approve"
            ? t("more.specialRequestsScreen.dialog.approveMessage")
            : t("more.specialRequestsScreen.dialog.rejectMessage")
        }
        showInput={true}
        inputPlaceholder={t("more.specialRequestsScreen.dialog.optionalNote")}
        inputValue={reviewNote}
        onInputChange={setReviewNote}
        confirmText={
          reviewState?.decision === "approve"
            ? t("more.specialRequestsScreen.actions.approve")
            : t("more.specialRequestsScreen.actions.reject")
        }
        onConfirm={handleReview}
        onCancel={() => setReviewState(null)}
        loading={submitting}
      />
    </View>
  );
}
