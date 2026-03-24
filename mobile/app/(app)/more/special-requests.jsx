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

function RequestCard({ item, colors, mode, onApprove, onReject }) {
  const statusTone =
    item.status === "approved"
      ? colors.success
      : item.status === "rejected"
        ? colors.danger
        : colors.warning;

  return (
    <View
      className="rounded-xl p-4 mb-3"
      style={{ backgroundColor: colors.backgroundSecondary }}
    >
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
              ? "Delete complaint request"
              : "Edit complaint request"}
          </Text>
          {item.requestType === "update" ? (
            <Text
              className="text-xs mt-1"
              style={{ color: colors.textSecondary }}
            >
              {item.currentDepartment !== item.requestedDepartment
                ? `Department: ${item.currentDepartment} -> ${item.requestedDepartment}`
                : null}
              {item.currentDepartment !== item.requestedDepartment &&
              item.currentPriority !== item.requestedPriority
                ? " | "
                : ""}
              {item.currentPriority !== item.requestedPriority
                ? `Priority: ${item.currentPriority} -> ${item.requestedPriority}`
                : null}
            </Text>
          ) : null}
          {item.reason ? (
            <Text
              className="text-xs mt-1"
              style={{ color: colors.textSecondary }}
            >
              {item.reason}
            </Text>
          ) : null}
          {item.requestedBy?.fullName || item.requestedBy?.username ? (
            <Text
              className="text-xs mt-1"
              style={{ color: colors.textSecondary }}
            >
              By {item.requestedBy.fullName || item.requestedBy.username}
            </Text>
          ) : null}
        </View>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: statusTone + "18" }}
        >
          <Text
            className="text-[11px] font-semibold"
            style={{ color: statusTone }}
          >
            {formatStatusLabel(undefined, item.status)}
          </Text>
        </View>
      </View>

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
              Approve
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
              Reject
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
    requestStartDate ? `From ${requestStartDate}` : null,
    requestEndDate ? `To ${requestEndDate}` : null,
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
            ? "Request approved"
            : "Request rejected",
      });
      setReviewState(null);
      setReviewNote("");
      await loadRequests();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not review request",
        text2: error?.response?.data?.message || "Please try again.",
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
      <BackButtonHeader title="Special Requests" />

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
            Loading requests...
          </Text>
        ) : filteredRequests.length === 0 ? (
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            No {statusFilter} requests.
          </Text>
        ) : (
          filteredRequests.map((item) => (
            <RequestCard
              key={item.id}
              item={item}
              colors={colors}
              mode={mode}
              onApprove={() =>
                setReviewState({ request: item, decision: "approve" })
              }
              onReject={() =>
                setReviewState({ request: item, decision: "reject" })
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
            ? "Approve request"
            : "Reject request"
        }
        message={
          reviewState?.decision === "approve"
            ? "Approve this special request and apply it to the complaint?"
            : "Reject this special request?"
        }
        showInput={true}
        inputPlaceholder="Optional note"
        inputValue={reviewNote}
        onInputChange={setReviewNote}
        confirmText={reviewState?.decision === "approve" ? "Approve" : "Reject"}
        onConfirm={handleReview}
        onCancel={() => setReviewState(null)}
        loading={submitting}
      />
    </View>
  );
}
