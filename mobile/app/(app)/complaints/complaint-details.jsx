import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Clock,
  MapPin,
  User,
  CheckCircle,
  FileText,
  AlertCircle,
  Image as ImageIcon,
  ThumbsUp,
  Star,
  MessageSquare,
  Users,
  Search,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import {
  GET_COMPLAINT_BY_ID_URL,
  UPVOTE_COMPLAINT_URL,
  SUBMIT_FEEDBACK_URL,
  HOD_ASSIGN_COMPLAINT_URL,
  HOD_WORKERS_URL,
  HOD_APPROVE_COMPLETION_URL,
  HOD_NEEDS_REWORK_URL,
  HOD_CANCEL_COMPLAINT_URL,
  UPDATE_COMPLAINT_STATUS_URL,
  WORKERS_URL,
} from "../../../url";
import apiCall from "../../../utils/api";
import { getStatusColor, getPriorityColor } from "../../../utils/colorHelpers";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";

export default function ComplaintDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const { t } = useTranslation();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaint, setComplaint] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Citizen-specific states
  const [upvoting, setUpvoting] = useState(false);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // HOD-specific states
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [workerSearchQuery, setWorkerSearchQuery] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [reworkReason, setReworkReason] = useState("");
  const [approving, setApproving] = useState(false);
  const [sendingRework, setSendingRework] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Worker-specific states
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [workerNotes, setWorkerNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // Common states
  const [imageModalVisible, setImageModalVisible] = useState(false);

  const normalizedWorkers = useMemo(
    () =>
      (workers || []).map((w, idx) => {
        const fallbackId = `worker-${idx}-${w.username || "unknown"}`;
        return {
          ...w,
          workerId: String(w.id || w._id || fallbackId),
        };
      }),
    [workers],
  );

  const filteredWorkers = useMemo(() => {
    const q = workerSearchQuery.trim().toLowerCase();
    if (!q) return normalizedWorkers;
    return normalizedWorkers.filter((w) => {
      return (
        String(w.fullName || "")
          .toLowerCase()
          .includes(q) ||
        String(w.username || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [normalizedWorkers, workerSearchQuery]);

  const currentAssignedWorker = useMemo(() => {
    if (!complaint?.assignedTo) return null;
    const assignedId = String(complaint.assignedTo);
    return normalizedWorkers.find((w) => w.workerId === assignedId) || null;
  }, [complaint?.assignedTo, normalizedWorkers]);

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [res, user] = await Promise.all([
        apiCall({
          method: "GET",
          url: GET_COMPLAINT_BY_ID_URL(id),
        }),
        getUserAuth(),
      ]);

      const payload = res?.data;
      const complaintData = payload?.complaint || null;
      setComplaint(complaintData);
      setUserRole(user?.role);
      setNewStatus(complaintData?.status || "");

      const userIdString = String(user?.id || user?._id);
      setCurrentUserId(userIdString);

      // Check if current user has upvoted (for citizens)
      if (
        user?.role === "user" &&
        complaintData?.upvotes &&
        userIdString &&
        userIdString !== "undefined"
      ) {
        const upvotedByUser = complaintData.upvotes.includes(userIdString);
        setHasUpvoted(upvotedByUser);
      }
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("common.failed"),
        text2:
          e?.response?.data?.message || t("complaints.details.couldNotLoad"),
      });
      if (e?.response?.status === 404) {
        setTimeout(() => router.back(), 1500);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadWorkers = async () => {
    try {
      const res = await apiCall({
        method: "GET",
        url: HOD_WORKERS_URL,
      });
      const payload = res?.data;
      let workerList = payload?.workers || [];

      // Fallback for cases where HOD endpoint returns partial data unexpectedly.
      if (workerList.length <= 1) {
        const fallbackRes = await apiCall({
          method: "GET",
          url: WORKERS_URL,
        });
        let fallbackList = fallbackRes?.data?.data || [];
        if (complaint?.department) {
          const complaintDept = String(complaint.department).toLowerCase();
          fallbackList = fallbackList.filter(
            (worker) =>
              String(worker.department || "").toLowerCase() === complaintDept,
          );
        }
        const merged = [...workerList, ...fallbackList].reduce(
          (acc, worker) => {
            const key = String(
              worker.id || worker._id || worker.username || Math.random(),
            );
            if (!acc.some((w) => String(w.id || w._id || w.username) === key)) {
              acc.push(worker);
            }
            return acc;
          },
          [],
        );
        workerList = merged;
      }

      setWorkers((prev) => {
        // Protect against late responses that would shrink an already-loaded list.
        if (Array.isArray(prev) && prev.length > workerList.length) {
          return prev;
        }
        return workerList;
      });
    } catch (e) {
      console.error("Failed to load workers:", e);
    }
  };

  useEffect(() => {
    if (id) {
      load(false);
    }
  }, [id]);

  // Citizen: Handle upvote
  const handleUpvote = async () => {
    if (upvoting) return;

    try {
      setUpvoting(true);
      await apiCall({
        method: "POST",
        url: UPVOTE_COMPLAINT_URL(id),
      });

      setHasUpvoted(!hasUpvoted);
      setComplaint({
        ...complaint,
        upvoteCount: hasUpvoted
          ? (complaint.upvoteCount || 1) - 1
          : (complaint.upvoteCount || 0) + 1,
      });

      Toast.show({
        type: "success",
        text1: hasUpvoted
          ? t("complaints.details.upvoteRemoved")
          : t("complaints.details.upvotedSuccess"),
        text2: hasUpvoted
          ? t("complaints.details.supportRemoved")
          : t("complaints.details.thanksForSupporting"),
      });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("common.failed"),
        text2:
          e?.response?.data?.message || t("complaints.details.couldNotUpvote"),
      });
    } finally {
      setUpvoting(false);
    }
  };

  // Citizen: Submit feedback
  const handleSubmitFeedback = async () => {
    if (!feedbackRating) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.ratingRequired"),
        text2: t("complaints.details.pleaseSelectRating"),
      });
      return;
    }

    try {
      setSubmittingFeedback(true);

      await apiCall({
        method: "POST",
        url: SUBMIT_FEEDBACK_URL(id),
        data: {
          rating: feedbackRating,
          comment: feedbackComment.trim(),
        },
      });

      Toast.show({
        type: "success",
        text1: t("complaints.details.feedbackSubmitted"),
        text2: t("complaints.details.thankYouFeedback"),
      });

      setFeedbackModalVisible(false);
      setFeedbackRating(0);
      setFeedbackComment("");
      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.submissionFailed"),
        text2:
          e?.response?.data?.message ||
          t("complaints.details.couldNotSubmitFeedback"),
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // HOD: Assign complaint
  const handleAssignComplaint = async () => {
    if (!selectedWorker) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.workerRequired"),
        text2: t("complaints.details.pleaseSelectWorker"),
      });
      return;
    }

    try {
      setAssigning(true);

      await apiCall({
        method: "POST",
        url: HOD_ASSIGN_COMPLAINT_URL,
        data: {
          complaintId: id,
          workerId: selectedWorker,
        },
      });

      Toast.show({
        type: "success",
        text1: complaint?.assignedTo
          ? t("complaints.details.assignmentUpdated")
          : t("complaints.details.complaintAssigned"),
        text2: complaint?.assignedTo
          ? t("complaints.details.workerAssignmentChanged")
          : t("complaints.details.workerNotified"),
      });

      setAssignModalVisible(false);
      setSelectedWorker(null);
      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.assignmentFailed"),
        text2:
          e?.response?.data?.message || t("complaints.details.couldNotAssign"),
      });
    } finally {
      setAssigning(false);
    }
  };

  // HOD: Approve completion
  const handleApproveCompletion = async () => {
    try {
      setApproving(true);

      await apiCall({
        method: "POST",
        url: HOD_APPROVE_COMPLETION_URL(id),
        data: {
          hodNotes: "Approved - Work completed satisfactorily",
        },
      });

      Toast.show({
        type: "success",
        text1: t("complaints.details.approved"),
        text2: t("complaints.details.markedAsResolved"),
      });

      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.approvalFailed"),
        text2:
          e?.response?.data?.message || t("complaints.details.couldNotApprove"),
      });
    } finally {
      setApproving(false);
    }
  };

  // HOD: Reject completion
  const handleRejectCompletion = async () => {
    if (!reworkReason.trim()) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.reasonRequired"),
        text2: t("complaints.details.provideReworkDetails"),
      });
      return;
    }

    try {
      setSendingRework(true);

      await apiCall({
        method: "POST",
        url: HOD_NEEDS_REWORK_URL(id),
        data: {
          reworkReason,
        },
      });

      Toast.show({
        type: "success",
        text1: t("complaints.details.sentForRework"),
        text2: t("complaints.details.workerNotified"),
      });

      setApprovalModalVisible(false);
      setReworkReason("");
      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.requestFailed"),
        text2:
          e?.response?.data?.message ||
          t("complaints.details.couldNotSendRework"),
      });
    } finally {
      setSendingRework(false);
    }
  };

  // HOD: Cancel complaint
  const handleCancelComplaint = async () => {
    try {
      setCancelling(true);
      await apiCall({
        method: "POST",
        url: HOD_CANCEL_COMPLAINT_URL(id),
      });

      Toast.show({
        type: "success",
        text1: t("complaints.details.cancelled"),
        text2: t("complaints.details.complaintCancelled"),
      });

      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.cancelFailed"),
        text2:
          e?.response?.data?.message || t("complaints.details.couldNotCancel"),
      });
    } finally {
      setCancelling(false);
    }
  };

  // Worker: Update status
  const handleUpdateStatus = async () => {
    if (!newStatus) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.statusRequired"),
        text2: t("complaints.details.pleaseSelectStatus"),
      });
      return;
    }

    try {
      setUpdating(true);

      await apiCall({
        method: "PUT",
        url: UPDATE_COMPLAINT_STATUS_URL(id),
        data: {
          status: newStatus,
          workerNotes: workerNotes,
        },
      });

      Toast.show({
        type: "success",
        text1: t("complaints.details.statusUpdated"),
        text2: `${t("complaints.details.markedAs", { status: newStatus })}`,
      });

      setStatusModalVisible(false);
      setWorkerNotes("");
      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.updateFailed"),
        text2:
          e?.response?.data?.message ||
          t("complaints.details.couldNotUpdateStatus"),
      });
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatHistoryDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatStatusLabel = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "needs-rework") return t("complaints.status.needsRework");
    if (s === "in-progress") return t("complaints.status.inProgress");
    if (s === "pending-approval") return t("complaints.status.pendingApproval");
    if (s === "assigned") return t("complaints.status.assigned");
    if (s === "resolved") return t("complaints.status.resolved");
    if (s === "cancelled") return t("complaints.status.cancelled");
    if (s === "pending") return t("complaints.status.pending");
    return String(status || "-").replace("-", " ");
  };

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title={t("complaints.details.title")} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            {t("complaints.details.loadingDetails")}
          </Text>
        </View>
      </View>
    );
  }

  if (!complaint) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title={t("complaints.details.title")} />
        <View className="flex-1 justify-center items-center p-6">
          <AlertCircle size={48} color={colors.textSecondary} />
          <Text
            className="text-lg font-bold mt-4"
            style={{ color: colors.textPrimary }}
          >
            {t("complaints.details.notFound")}
          </Text>
          <Text
            className="text-sm mt-2 text-center"
            style={{ color: colors.textSecondary }}
          >
            {t("complaints.details.notFoundMessage")}
          </Text>
        </View>
      </View>
    );
  }

  const statusOptions = [
    { value: "assigned", label: t("complaints.status.assigned") },
    { value: "in-progress", label: t("complaints.status.inProgress") },
    {
      value: "pending-approval",
      label: t("complaints.status.pendingApproval"),
    },
  ];

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("complaints.details.title")} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Ticket ID Card */}
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <View className="items-center">
            <Text
              className="text-sm mb-1"
              style={{ color: colors.textSecondary }}
            >
              {t("complaints.details.ticketId")}
            </Text>
            <Text
              className="text-2xl font-bold"
              style={{ color: colors.primary }}
            >
              #{complaint.ticketId}
            </Text>
          </View>
        </Card>

        {/* Status and Priority */}
        <View className="flex-row mb-3">
          <Card style={{ margin: 0, marginRight: 6, flex: 1 }}>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {t("complaints.details.status")}
            </Text>
            <Text
              className="text-lg font-bold mt-1 capitalize"
              style={{ color: getStatusColor(complaint.status, colors) }}
            >
              {formatStatusLabel(complaint.status)}
            </Text>
          </Card>
          <Card style={{ margin: 0, marginLeft: 6, flex: 1 }}>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {t("complaints.details.priority")}
            </Text>
            <Text
              className="text-lg font-bold mt-1"
              style={{ color: getPriorityColor(complaint.priority, colors) }}
            >
              {complaint.priority || "-"}
            </Text>
          </Card>
        </View>

        {/* Citizen: Upvote Button (Interactive) */}
        {userRole === "user" && (
          <PressableBlock onPress={handleUpvote} disabled={upvoting}>
            <Card
              style={{
                margin: 0,
                marginBottom: 12,
                flex: 0,
                backgroundColor: hasUpvoted
                  ? colors.primary + "20"
                  : colors.backgroundSecondary,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <ThumbsUp
                    size={24}
                    color={hasUpvoted ? colors.primary : colors.textSecondary}
                    fill={hasUpvoted ? colors.primary : "transparent"}
                  />
                  <View className="ml-3 flex-1">
                    <Text
                      className="text-base font-semibold"
                      style={{
                        color: hasUpvoted ? colors.primary : colors.textPrimary,
                      }}
                    >
                      {hasUpvoted
                        ? t("complaints.details.youSupportThis")
                        : t("complaints.details.supportThisComplaint")}
                    </Text>
                    <Text
                      className="text-sm mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {complaint.upvoteCount || 0}{" "}
                      {(complaint.upvoteCount || 0) === 1
                        ? t("complaints.details.personAffected")
                        : t("complaints.details.peopleAffected")}
                    </Text>
                  </View>
                </View>
                {upvoting && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </View>
            </Card>
          </PressableBlock>
        )}

        {/* HOD/Worker: Upvote Count (Read-only) */}
        {(userRole === "head" || userRole === "worker") && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <View className="flex-row items-center">
              <ThumbsUp size={20} color={colors.primary} />
              <Text
                className="text-base font-semibold ml-2"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.details.communitySupport")}
              </Text>
            </View>
            <Text
              className="text-sm mt-2"
              style={{ color: colors.textSecondary }}
            >
              {complaint.upvoteCount || 0}{" "}
              {(complaint.upvoteCount || 0) === 1
                ? t("complaints.details.personAffected")
                : t("complaints.details.peopleAffected")}
            </Text>
          </Card>
        )}

        {/* HOD: Current Assigned Worker */}
        {userRole === "head" && complaint.assignedTo && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <View className="flex-row items-center mb-1">
              <Users size={18} color={colors.primary} />
              <Text
                className="text-sm ml-2"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.details.currentlyAssigned")}
              </Text>
            </View>
            <Text
              className="text-base font-semibold"
              style={{ color: colors.textPrimary }}
            >
              {currentAssignedWorker?.fullName ||
                complaint.assignedWorkerName ||
                t("complaints.details.assignedWorker")}
            </Text>
          </Card>
        )}

        {/* HOD: Assign Worker Button */}
        {userRole === "head" &&
          complaint.status !== "resolved" &&
          complaint.status !== "cancelled" && (
            <PressableBlock
              onPress={() => {
                if (!workers.length) {
                  loadWorkers();
                }
                setAssignModalVisible(true);
                setWorkerSearchQuery("");
                setSelectedWorker(
                  complaint?.assignedTo ? String(complaint.assignedTo) : null,
                );
              }}
            >
              <Card
                style={{
                  margin: 0,
                  marginBottom: 12,
                  flex: 0,
                  backgroundColor: colors.primary,
                }}
              >
                <View className="flex-row items-center justify-center">
                  <Users size={20} color="#FFFFFF" />
                  <Text
                    className="text-base font-semibold ml-2"
                    style={{ color: "#FFFFFF" }}
                  >
                    {complaint.assignedTo
                      ? t("complaints.details.reassignWorker")
                      : t("complaints.details.assignToWorker")}
                  </Text>
                </View>
              </Card>
            </PressableBlock>
          )}

        {userRole === "head" &&
          complaint.status !== "resolved" &&
          complaint.status !== "cancelled" &&
          !complaint.assignedTo && (
            <PressableBlock
              onPress={handleCancelComplaint}
              disabled={cancelling}
            >
              <Card
                style={{
                  margin: 0,
                  marginBottom: 12,
                  flex: 0,
                  backgroundColor: colors.error || "#EF4444",
                }}
              >
                <View className="flex-row items-center justify-center">
                  {cancelling ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      {t("complaints.details.cancelComplaint")}
                    </Text>
                  )}
                </View>
              </Card>
            </PressableBlock>
          )}

        {/* HOD: Review Pending Approval */}
        {userRole === "head" && complaint.status === "pending-approval" && (
          <View className="mb-3">
            <Card
              style={{
                margin: 0,
                marginBottom: 8,
                flex: 0,
                backgroundColor: colors.success || "#10B981",
              }}
            >
              <PressableBlock
                onPress={handleApproveCompletion}
                disabled={approving}
              >
                <View className="flex-row items-center justify-center py-1">
                  {approving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text
                        className="text-base font-semibold"
                        style={{ color: "#FFFFFF" }}
                      >
                        {t("complaints.details.approveCompletion")}
                      </Text>
                    </>
                  )}
                </View>
              </PressableBlock>
            </Card>

            <Card
              style={{
                margin: 0,
                flex: 0,
                backgroundColor: colors.error || "#EF4444",
              }}
            >
              <PressableBlock onPress={() => setApprovalModalVisible(true)}>
                <View className="flex-row items-center justify-center py-1">
                  <Text
                    className="text-base font-semibold"
                    style={{ color: "#FFFFFF" }}
                  >
                    {t("complaints.details.requestRework")}
                  </Text>
                </View>
              </PressableBlock>
            </Card>
          </View>
        )}

        {/* Worker: Update Status Button */}
        {userRole === "worker" &&
          complaint.status !== "resolved" &&
          complaint.status !== "cancelled" && (
            <PressableBlock onPress={() => setStatusModalVisible(true)}>
              <Card
                style={{
                  margin: 0,
                  marginBottom: 12,
                  flex: 0,
                  backgroundColor: colors.primary,
                }}
              >
                <Text
                  className="text-base font-semibold text-center"
                  style={{ color: "#FFFFFF" }}
                >
                  {t("complaints.details.updateStatus")}
                </Text>
              </Card>
            </PressableBlock>
          )}

        {/* Title and Description */}
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <View className="mb-3">
            <View className="flex-row items-center mb-1">
              <FileText size={20} color={colors.primary} />
              <Text
                className="text-sm ml-2"
                style={{ color: colors.textSecondary }}
              >
                Title
              </Text>
            </View>
            <Text
              className="text-base font-semibold"
              style={{ color: colors.textPrimary }}
            >
              {complaint.title || t("complaints.complaint")}
            </Text>
          </View>

          <View
            className="h-[1px] mb-3"
            style={{ backgroundColor: colors.border }}
          />

          <View>
            <Text
              className="text-sm mb-1"
              style={{ color: colors.textSecondary }}
            >
              {t("complaints.details.complaintDescription")}
            </Text>
            <Text
              className="text-base leading-6"
              style={{ color: colors.textPrimary }}
            >
              {complaint.description || t("complaints.details.noDescription")}
            </Text>
          </View>
        </Card>

        {/* Department and Location */}
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <View className="flex-row items-start mb-3">
            <User size={20} color={colors.primary} style={{ marginTop: 2 }} />
            <View className="flex-1 ml-3">
              <Text
                className="text-sm mb-1"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.details.department")}
              </Text>
              <Text
                className="text-base font-semibold capitalize"
                style={{ color: colors.textPrimary }}
              >
                {complaint.department || "-"}
              </Text>
            </View>
          </View>

          <View
            className="h-[1px] mb-3"
            style={{ backgroundColor: colors.border }}
          />

          <View className="flex-row items-start">
            <MapPin size={20} color={colors.primary} style={{ marginTop: 2 }} />
            <View className="flex-1 ml-3">
              <Text
                className="text-sm mb-1"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.details.location")}
              </Text>
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {complaint.locationName || t("complaints.details.notSpecified")}
              </Text>
              {complaint.coordinates && (
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.textSecondary }}
                >
                  {complaint.coordinates.lat?.toFixed(6)},{" "}
                  {complaint.coordinates.lng?.toFixed(6)}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Proof Image */}
        {complaint.proofImage &&
          (Array.isArray(complaint.proofImage)
            ? complaint.proofImage.length > 0
            : true) && (
            <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
              <View className="flex-row items-center mb-3">
                <ImageIcon size={20} color={colors.primary} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {Array.isArray(complaint.proofImage) &&
                  complaint.proofImage.length > 1
                    ? t("complaints.details.proofImages")
                    : t("complaints.details.proofImage")}
                </Text>
              </View>
              {Array.isArray(complaint.proofImage) ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {complaint.proofImage.map((img, idx) => (
                    <PressableBlock
                      key={idx}
                      onPress={() => setImageModalVisible(true)}
                    >
                      <Image
                        source={{ uri: img }}
                        className="w-32 h-32 rounded-xl mr-2"
                        resizeMode="cover"
                      />
                    </PressableBlock>
                  ))}
                </ScrollView>
              ) : (
                <PressableBlock onPress={() => setImageModalVisible(true)}>
                  <Image
                    source={{ uri: complaint.proofImage }}
                    className="w-full h-48 rounded-xl"
                    resizeMode="cover"
                  />
                  <View className="absolute inset-0 items-center justify-center bg-black/10 rounded-xl">
                    <View
                      className="px-3 py-1.5 rounded-lg"
                      style={{ backgroundColor: colors.backgroundPrimary }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: colors.textPrimary }}
                      >
                        {t("complaints.details.tapToViewFullSize")}
                      </Text>
                    </View>
                  </View>
                </PressableBlock>
              )}
            </Card>
          )}

        {/* Completion Photos (Before/After) - Visible to all roles */}
        {complaint.completionPhotos &&
          complaint.completionPhotos.length > 0 && (
            <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
              <View className="flex-row items-center mb-3">
                <ImageIcon size={20} color={colors.success || "#10B981"} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.details.completionPhotos")}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {complaint.completionPhotos.map((img, idx) => (
                  <PressableBlock
                    key={idx}
                    onPress={() => setImageModalVisible(true)}
                  >
                    <Image
                      source={{ uri: img }}
                      className="w-32 h-32 rounded-xl mr-2"
                      resizeMode="cover"
                    />
                  </PressableBlock>
                ))}
              </ScrollView>
            </Card>
          )}

        {/* Timeline */}
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <View className="flex-row items-center mb-3">
            <Clock size={20} color={colors.primary} />
            <Text
              className="text-base font-semibold ml-2"
              style={{ color: colors.textPrimary }}
            >
              {t("complaints.details.timeline")}
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {t("complaints.details.created")}
            </Text>
            <Text
              className="text-base font-semibold mt-1"
              style={{ color: colors.textPrimary }}
            >
              {formatDate(complaint.createdAt)}
            </Text>
          </View>

          <View
            className="h-[1px] mb-3"
            style={{ backgroundColor: colors.border }}
          />

          <View className="mb-3">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {t("complaints.details.lastUpdated")}
            </Text>
            <Text
              className="text-base font-semibold mt-1"
              style={{ color: colors.textPrimary }}
            >
              {formatDate(complaint.updatedAt)}
            </Text>
          </View>

          {/* Show ETA for assigned/in-progress complaints */}
          {complaint.estimatedCompletionTime &&
            (complaint.status === "assigned" ||
              complaint.status === "in-progress") && (
              <>
                <View
                  className="h-[1px] mb-3"
                  style={{ backgroundColor: colors.border }}
                />
                <View>
                  <Text
                    className="text-sm"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("complaints.details.estimatedCompletion")}
                  </Text>
                  <Text
                    className="text-base font-semibold mt-1"
                    style={{ color: colors.warning || "#f59e0b" }}
                  >
                    {complaint.estimatedCompletionTime < 24
                      ? `${complaint.estimatedCompletionTime} ${t("complaints.details.hours")}`
                      : `${Math.round(complaint.estimatedCompletionTime / 24)} ${t("complaints.details.days")}`}
                  </Text>
                  {userRole === "head" && (
                    <Text
                      className="text-xs mt-1"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("complaints.details.etaExplanation")}
                    </Text>
                  )}
                </View>
              </>
            )}
        </Card>

        {/* Status History */}
        {complaint.history && complaint.history.length > 0 && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <Text
              className="text-base font-semibold mb-3"
              style={{ color: colors.textPrimary }}
            >
              {t("complaints.details.statusHistory")}
            </Text>
            {complaint.history.map((item, index) => (
              <View key={index}>
                {index > 0 && (
                  <View
                    className="h-[1px] my-3"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text
                      className="text-sm font-semibold capitalize"
                      style={{ color: colors.textPrimary }}
                    >
                      {formatStatusLabel(item.status)}
                    </Text>
                    {item.note && (
                      <Text
                        className="text-xs mt-1"
                        style={{ color: colors.textSecondary }}
                      >
                        {item.note}
                      </Text>
                    )}
                  </View>
                  <Text
                    className="text-xs ml-2"
                    style={{ color: colors.textSecondary }}
                  >
                    {formatHistoryDate(item.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Citizen Feedback - Visible to HOD and Worker */}
        {(userRole === "head" || userRole === "worker") &&
          complaint.feedback &&
          complaint.feedback.rating && (
            <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
              <Text
                className="text-base font-semibold mb-3"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.details.citizenFeedback")}
              </Text>

              <View className="flex-row items-center mb-2">
                <Star
                  size={18}
                  color={colors.warning || "#ffc107"}
                  fill={colors.warning || "#ffc107"}
                />
                <Text
                  className="text-lg font-bold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {complaint.feedback.rating}/5
                </Text>
              </View>

              {complaint.feedback.comment && (
                <View className="mt-2">
                  <View className="flex-row items-start mb-1">
                    <MessageSquare size={16} color={colors.textSecondary} />
                    <Text
                      className="text-sm font-semibold ml-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("complaints.details.comment")}
                    </Text>
                  </View>
                  <Text
                    className="text-sm ml-6"
                    style={{ color: colors.textPrimary }}
                  >
                    {complaint.feedback.comment}
                  </Text>
                </View>
              )}
            </Card>
          )}

        {/* Citizen: Rate Resolution Button */}
        {userRole === "user" &&
          complaint.status === "resolved" &&
          String(complaint.userId) === String(currentUserId) &&
          !complaint.feedback?.rating && (
            <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
              <View className="items-center">
                <Text
                  className="text-base font-semibold mb-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.details.rateResolution")}
                </Text>
                <Text
                  className="text-sm text-center mb-4"
                  style={{ color: colors.textSecondary }}
                >
                  {t("complaints.details.helpUsImprove")}
                </Text>
                <PressableBlock onPress={() => setFeedbackModalVisible(true)}>
                  <View
                    className="px-6 py-3 rounded-xl"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text
                      className="text-base font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      {t("complaints.details.submitFeedback")}
                    </Text>
                  </View>
                </PressableBlock>
              </View>
            </Card>
          )}

        {/* Citizen: Your Feedback Display */}
        {userRole === "user" && complaint.feedback?.rating && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <View className="flex-row items-center mb-2">
              <Star size={20} color={colors.primary} fill={colors.primary} />
              <Text
                className="text-base font-semibold ml-2"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.details.yourFeedback")}
              </Text>
            </View>
            <View className="flex-row items-center mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={20}
                  color={colors.primary}
                  fill={
                    star <= (complaint.feedback?.rating || 0)
                      ? colors.primary
                      : "transparent"
                  }
                  style={{ marginRight: 4 }}
                />
              ))}
              <Text
                className="ml-2 text-sm"
                style={{ color: colors.textSecondary }}
              >
                {complaint.feedback?.rating}/5
              </Text>
            </View>
            {complaint.feedback?.comment && (
              <Text
                className="text-sm mt-3"
                style={{ color: colors.textPrimary }}
              >
                {complaint.feedback.comment}
              </Text>
            )}
          </Card>
        )}
      </ScrollView>

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View
          className="flex-1"
          style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
        >
          <View className="flex-1 justify-center items-center">
            <Pressable
              onPress={() => setImageModalVisible(false)}
              className="absolute top-12 right-4 z-10 w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <Text className="text-white text-2xl font-bold">×</Text>
            </Pressable>
            <Image
              source={{
                uri: Array.isArray(complaint.proofImage)
                  ? complaint.proofImage[0]
                  : complaint.proofImage,
              }}
              className="w-full h-full"
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>

      {/* Citizen: Feedback Modal */}
      {userRole === "user" && (
        <Modal
          visible={feedbackModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setFeedbackModalVisible(false)}
        >
          <View
            className="flex-1 justify-end"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <View
              className="rounded-t-3xl p-6"
              style={{ backgroundColor: colors.backgroundPrimary }}
            >
              <Text
                className="text-xl font-bold mb-2 text-center"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.details.rateThisResolution")}
              </Text>
              <Text
                className="text-sm mb-6 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.details.howSatisfied")}
              </Text>

              <View className="flex-row justify-center mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => setFeedbackRating(star)}
                    style={{ padding: 8 }}
                  >
                    <Star
                      size={40}
                      color={colors.primary}
                      fill={
                        star <= feedbackRating ? colors.primary : "transparent"
                      }
                    />
                  </Pressable>
                ))}
              </View>

              <Text
                className="text-sm mb-2"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.details.additionalComments")}
              </Text>
              <TextInput
                value={feedbackComment}
                onChangeText={setFeedbackComment}
                placeholder={t("complaints.details.shareYourExperience")}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                className="rounded-xl p-4 mb-6"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  textAlignVertical: "top",
                }}
              />

              <View className="flex-row">
                <Pressable
                  onPress={() => {
                    setFeedbackModalVisible(false);
                    setFeedbackRating(0);
                    setFeedbackComment("");
                  }}
                  className="flex-1 mr-2 py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("common.cancel")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSubmitFeedback}
                  disabled={submittingFeedback || !feedbackRating}
                  className="flex-1 ml-2 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: feedbackRating
                      ? colors.primary
                      : colors.backgroundSecondary,
                    opacity: submittingFeedback || !feedbackRating ? 0.5 : 1,
                  }}
                >
                  {submittingFeedback ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      {t("common.submit")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* HOD: Assign Worker Modal */}
      {userRole === "head" && (
        <Modal
          visible={assignModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setAssignModalVisible(false)}
        >
          <View
            className="flex-1 justify-end"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <View
              className="rounded-t-3xl p-6"
              style={{ backgroundColor: colors.backgroundPrimary }}
            >
              <Text
                className="text-xl font-bold mb-4 text-center"
                style={{ color: colors.textPrimary }}
              >
                {complaint?.assignedTo
                  ? t("complaints.details.changeAssignment")
                  : t("complaints.details.assignToWorker")}
              </Text>

              {/* Worker Search */}
              <View className="mb-3">
                <View
                  className="flex-row items-center px-4 py-3 rounded-xl"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Search size={18} color={colors.textSecondary} />
                  <TextInput
                    className="flex-1 ml-2 text-sm"
                    style={{ color: colors.textPrimary }}
                    placeholder={t("complaints.details.searchWorkers")}
                    placeholderTextColor={colors.textSecondary}
                    value={workerSearchQuery}
                    onChangeText={setWorkerSearchQuery}
                  />
                  {workerSearchQuery && (
                    <TouchableOpacity onPress={() => setWorkerSearchQuery("")}>
                      <X size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <ScrollView
                className="max-h-96 mb-4"
                showsVerticalScrollIndicator={false}
              >
                {filteredWorkers.map((worker) => (
                  <Pressable
                    key={worker.workerId}
                    onPress={() => setSelectedWorker(worker.workerId)}
                    className="mb-2"
                  >
                    <Card
                      style={{
                        margin: 0,
                        backgroundColor:
                          selectedWorker === worker.workerId
                            ? colors.primary + "20"
                            : colors.backgroundSecondary,
                        borderWidth: selectedWorker === worker.workerId ? 2 : 0,
                        borderColor: colors.primary,
                      }}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text
                          className="text-base font-semibold"
                          style={{
                            color:
                              selectedWorker === worker.workerId
                                ? colors.primary
                                : colors.textPrimary,
                          }}
                        >
                          {worker.fullName}
                        </Text>
                        {selectedWorker === worker.workerId && (
                          <CheckCircle size={22} color={colors.primary} />
                        )}
                      </View>
                    </Card>
                  </Pressable>
                ))}
                {filteredWorkers.length === 0 && (
                  <Card style={{ margin: 0, flex: 0 }}>
                    <Text style={{ color: colors.textSecondary }}>
                      {t("complaints.details.noWorkersFound")}
                    </Text>
                  </Card>
                )}
              </ScrollView>

              <View className="flex-row">
                <Pressable
                  onPress={() => {
                    setAssignModalVisible(false);
                    setSelectedWorker(null);
                    setWorkerSearchQuery("");
                  }}
                  className="flex-1 mr-2 py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("common.cancel")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleAssignComplaint}
                  disabled={assigning}
                  className="flex-1 ml-2 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: colors.primary,
                    opacity: assigning ? 0.5 : 1,
                  }}
                >
                  {assigning ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      {complaint?.assignedTo
                        ? t("complaints.details.changeAssignment")
                        : t("complaints.details.assign")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Worker: Status Update Modal */}
      {userRole === "worker" && (
        <Modal
          visible={statusModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setStatusModalVisible(false)}
        >
          <View
            className="flex-1 justify-end"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <View
              className="rounded-t-3xl p-6"
              style={{ backgroundColor: colors.backgroundPrimary }}
            >
              <Text
                className="text-xl font-bold mb-4 text-center"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.details.updateComplaintStatus")}
              </Text>

              <View className="mb-4">
                {statusOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setNewStatus(option.value)}
                    className="mb-2"
                  >
                    <Card
                      style={{
                        margin: 0,
                        backgroundColor:
                          newStatus === option.value
                            ? colors.primary + "20"
                            : colors.backgroundSecondary,
                        borderWidth: newStatus === option.value ? 2 : 0,
                        borderColor: colors.primary,
                      }}
                    >
                      <Text
                        className="text-base font-semibold"
                        style={{
                          color:
                            newStatus === option.value
                              ? colors.primary
                              : colors.textPrimary,
                        }}
                      >
                        {option.label}
                      </Text>
                    </Card>
                  </Pressable>
                ))}
              </View>

              <Text
                className="text-sm mb-2"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.details.notesOptional")}
              </Text>
              <TextInput
                value={workerNotes}
                onChangeText={setWorkerNotes}
                placeholder={t("complaints.details.addWorkNotes")}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                className="rounded-xl p-4 mb-6"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  textAlignVertical: "top",
                }}
              />

              <View className="flex-row">
                <Pressable
                  onPress={() => {
                    setStatusModalVisible(false);
                    setWorkerNotes("");
                  }}
                  className="flex-1 mr-2 py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("common.cancel")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleUpdateStatus}
                  disabled={updating}
                  className="flex-1 ml-2 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: colors.primary,
                    opacity: updating ? 0.5 : 1,
                  }}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      {t("common.update")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* HOD: Rework Reason Modal */}
      {userRole === "head" && (
        <Modal
          visible={approvalModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setApprovalModalVisible(false)}
        >
          <View
            className="flex-1 justify-end"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <View
              className="rounded-t-3xl p-6"
              style={{ backgroundColor: colors.backgroundPrimary }}
            >
              <Text
                className="text-xl font-bold mb-4 text-center"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.details.requestReworkTitle")}
              </Text>

              <Text
                className="text-sm mb-2"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.details.reworkReasonRequired")}
              </Text>
              <TextInput
                value={reworkReason}
                onChangeText={setReworkReason}
                placeholder={t("complaints.details.explainWhatNeedsFixing")}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                className="rounded-xl p-4 mb-6"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  textAlignVertical: "top",
                }}
              />

              <View className="flex-row">
                <Pressable
                  onPress={() => {
                    setApprovalModalVisible(false);
                    setReworkReason("");
                  }}
                  className="flex-1 mr-2 py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("common.cancel")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleRejectCompletion}
                  disabled={sendingRework || !reworkReason.trim()}
                  className="flex-1 ml-2 py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: colors.error || "#EF4444",
                    opacity: sendingRework || !reworkReason.trim() ? 0.5 : 1,
                  }}
                >
                  {sendingRework ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      {t("complaints.details.sendForRework")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
