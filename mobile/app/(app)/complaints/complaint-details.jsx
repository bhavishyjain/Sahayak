import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronUp,
  Clock,
  FileDown,
  FileText,
  Image as ImageIcon,
  Info,
  MapPin,
  MessageSquare,
  Share2,
  ShieldAlert,
  RotateCcw,
  Star,
  Tag,
  ThumbsDown,
  ThumbsUp,
  User,
  Users,
  Upload,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { WebView } from "react-native-webview";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import ComplaintTimeline from "../../../components/ComplaintTimeline";
import DialogBox from "../../../components/DialogBox";
import PressableBlock from "../../../components/PressableBlock";
import {
  GET_SATISFACTION_URL,
} from "../../../url";
import apiCall from "../../../utils/api";
import {
  CANONICAL_COMPLAINT_STATUSES,
  formatStatusLabel,
  getPriorityColor,
  getStatusColor,
  HEAD_MANAGE_BLOCKED_STATUSES,
  normalizeStatus,
  WORKER_ACTIONABLE_STATUSES,
} from "../../../data/complaintStatus";
import { getSlaCountdown } from "../../../utils/complaintHelpers";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";
import { getCachedComplaintDetail } from "../../../utils/complaintsCache";
import ErrorBoundary from "../../../components/ErrorBoundary";
import {
  addRealtimeListener,
  subscribeToComplaint,
  unsubscribeFromComplaint,
} from "../../../utils/realtime/socket";
import { useComplaintDetail } from "../../../utils/hooks/useComplaintDetail";
import {
  useComplaintCitizenActions,
  useComplaintHodActions,
  useComplaintWorkerActions,
} from "../../../utils/hooks/useComplaintActions";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

function ComplaintDetailsInner() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const { t } = useTranslation();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [complaint, setComplaint] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Citizen-specific states
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");

  // HOD-specific states
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [reworkReason, setReworkReason] = useState("");
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Worker-specific states
  const [photoUploadModalVisible, setPhotoUploadModalVisible] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);

  // Satisfaction voting states
  const [satisfactionVotes, setSatisfactionVotes] = useState(null);

  // Common states
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState("");
  const [upvoteInfoModalVisible, setUpvoteInfoModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

  const openImagePreview = (uri) => {
    const sourceUri = String(uri || "").trim();
    if (!sourceUri) return;
    setPreviewImageUri(sourceUri);
    setImageModalVisible(true);
  };

  const closeImagePreview = () => {
    setImageModalVisible(false);
    setPreviewImageUri("");
  };

  // SLA live countdown — recomputed every 60 s
  const [slaCountdown, setSlaCountdown] = useState(null);

  useEffect(() => {
    if (!complaint?.sla?.dueDate) {
      setSlaCountdown(null);
      return;
    }
    const update = () =>
      setSlaCountdown(getSlaCountdown(complaint.sla.dueDate));
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [complaint?.sla?.dueDate]);

  const complaintQuery = useComplaintDetail(id);
  const {
    data: complaintQueryData,
    error: complaintQueryError,
    refetch: refetchComplaintQuery,
  } = complaintQuery;
  const loading = complaintQuery.isLoading && !complaint;
  const refreshing = complaintQuery.isRefetching && !loading;

  useEffect(() => {
    if (!complaintQueryData) return;
    const complaintData = complaintQueryData.complaint ?? null;
    const nextUserRole = complaintQueryData.userRole ?? null;
    const userIdString = String(complaintQueryData.currentUserId || "");

    setComplaint(complaintData);
    setUserRole(nextUserRole);
    setCurrentUserId(userIdString);

    if (
      nextUserRole === "user" &&
      complaintData?.upvotes &&
      userIdString &&
      userIdString !== "undefined"
    ) {
      setHasUpvoted(complaintData.upvotes.includes(userIdString));
    }
  }, [complaintQueryData]);

  useEffect(() => {
    if (complaint?.status === "resolved") {
      fetchSatisfactionVotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaint?.status, id]);

  useEffect(() => {
    if (!complaintQueryError) return;

    let cancelled = false;
    const restoreCachedComplaint = async () => {
      const cached = await getCachedComplaintDetail(id);
      if (cached && !cancelled) {
        const user = await getUserAuth();
        setComplaint(cached);
        setUserRole(user?.role ?? null);
        setCurrentUserId(String(user?.id || user?._id || ""));
        return;
      }

      if (!cancelled) {
        Toast.show({
          type: "error",
          text1: t("common.failed"),
          text2:
            complaintQueryError?.response?.data?.message ||
            t("complaints.details.couldNotLoad"),
        });
        if (complaintQueryError?.response?.status === 404) {
          setTimeout(() => router.back(), 1500);
        }
      }
    };

    restoreCachedComplaint();
    return () => {
      cancelled = true;
    };
  }, [complaintQueryError, id, router, t]);

  const refreshComplaint = useCallback(async () => {
    await refetchComplaintQuery();
  }, [refetchComplaintQuery]);

  const {
    toggleUpvote,
    submitFeedback,
    voteSatisfaction,
    upvoting,
    submittingFeedback,
    votingInProgress,
  } = useComplaintCitizenActions({
    complaintId: id,
    t,
    hasUpvoted,
    onUpvoteSuccess: async () => {
      setHasUpvoted((prev) => !prev);
      setComplaint((prev) =>
        prev
          ? {
              ...prev,
              upvoteCount: hasUpvoted
                ? Math.max(0, Number(prev.upvoteCount || 0) - 1)
                : Number(prev.upvoteCount || 0) + 1,
            }
          : prev,
      );
      await refreshComplaint();
    },
    onFeedbackSuccess: async () => {
      setFeedbackModalVisible(false);
      setFeedbackRating(0);
      setFeedbackComment("");
      await refreshComplaint();
    },
    onSatisfactionSuccess: async (votes) => {
      if (votes) {
        setSatisfactionVotes(votes);
      } else {
        await fetchSatisfactionVotes();
      }
    },
  });

  const {
    startWork,
    uploadCompletionPhotos,
    startingWork,
    uploadingPhotos,
  } = useComplaintWorkerActions({
    complaintId: id,
    t,
    onStartWorkSuccess: refreshComplaint,
    onUploadSuccess: async () => {
      setSelectedPhotos([]);
      await refreshComplaint();
    },
  });

  const {
    approveCompletion,
    sendForRework,
    cancelComplaint,
    applyAiSuggestion,
    approving,
    sendingRework,
    cancelling,
  } = useComplaintHodActions({
    complaintId: id,
    t,
    onApproveSuccess: refreshComplaint,
    onReworkSuccess: async () => {
      setApprovalModalVisible(false);
      setReworkReason("");
      await refreshComplaint();
    },
    onCancelSuccess: async () => {
      await refreshComplaint();
      closeCancelModal();
    },
    onAiSuccess: refreshComplaint,
  });

  // Auto-refresh when a push notification arrives that relates to this complaint
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification?.request?.content?.data;
        // Backend sends `complaintId` in the notification payload
        if (data?.complaintId && String(data.complaintId) === String(id)) {
          refreshComplaint();
        }
      },
    );
    return () => sub.remove();
  }, [id, refreshComplaint]);

  useEffect(() => {
    if (!id) return undefined;

    subscribeToComplaint(id).catch(() => {});
    const unsubscribeComplaintUpdated = addRealtimeListener(
      "complaint-updated",
      (payload) => {
        if (String(payload?.complaintId || "") !== String(id)) return;
        refreshComplaint();
      },
    );

    return () => {
      unsubscribeComplaintUpdated();
      unsubscribeFromComplaint(id);
    };
  }, [id, refreshComplaint]);

  // Citizen: Handle upvote
  const handleUpvote = async () => {
    if (upvoting) return;
    await toggleUpvote();
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

    await submitFeedback({
      rating: feedbackRating,
      comment: feedbackComment.trim(),
    });
  };

  // HOD: Approve completion
  const handleApproveCompletion = async () => {
    await approveCompletion();
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

    await sendForRework(reworkReason);
  };

  // HOD: Cancel complaint
  const closeCancelModal = () => {
    if (cancelling) return;
    setCancelModalVisible(false);
    setCancelReason("");
  };

  const handleCancelComplaint = async (reasonValue) => {
    const reason = String(reasonValue ?? cancelReason).trim();
    if (!reason) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.reasonRequired"),
        text2: t("complaints.details.cancelReasonPlaceholder"),
      });
      return;
    }

    await cancelComplaint(reason);
  };

  // HOD: Apply AI Suggestion
  const handleApplyAISuggestion = async (applyDepartment, applyPriority) => {
    await applyAiSuggestion(applyDepartment, applyPriority);
  };

  const handleStartWork = async () => {
    if (startingWork) return;

    await startWork();
  };

  // Worker: Take photo with camera
  const takePhoto = async () => {
    if (selectedPhotos.length >= 5) return;

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: t("complaints.details.permissionRequired"),
          text2: t("complaints.details.cameraPermissionDenied"),
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        setSelectedPhotos((prev) => {
          const remainingSlots = 5 - prev.length;
          const nextAssets = result.assets.slice(0, remainingSlots);
          return [...prev, ...nextAssets];
        });
      }
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.takePhotoFailed"),
        text2: err.message,
      });
    }
  };

  const removeSelectedPhoto = (indexToRemove) => {
    setSelectedPhotos((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  // Worker: Upload completion photos and submit for HOD approval
  const handleUploadFromModal = async () => {
    if (!selectedPhotos?.length) return;
    await uploadCompletionPhotos(selectedPhotos);
    setPhotoUploadModalVisible(false);
  };

  // Fetch satisfaction votes
  const fetchSatisfactionVotes = async () => {
    try {
      const response = await apiCall({
        method: "GET",
        url: GET_SATISFACTION_URL(id),
      });

      if (response?.data?.satisfactionVotes) {
        setSatisfactionVotes(response.data.satisfactionVotes);
      }
    } catch (err) {
      // Silently fail - votes are not critical, don't show error to user
      if (__DEV__) {
        console.log("Failed to fetch satisfaction votes:", err.message);
      }
    }
  };

  // Handle satisfaction vote
  const handleSatisfactionVote = async (voteType) => {
    if (votingInProgress) return;

    await voteSatisfaction(voteType);
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

  const handleShare = async () => {
    try {
      const link = `sahayak://complaints/complaint-details?id=${id}`;
      const shareMessage = [
        t("complaints.details.shareHeader", {
          ticketId: complaint.ticketId,
          department: complaint.department,
        }),
        t("complaints.details.shareStatusLine", {
          status: complaint.status,
          priority: complaint.priority,
        }),
        t("complaints.details.shareOpenInApp", { link }),
      ].join("\n\n");

      await Share.share({
        message: shareMessage,
        url: link,
      });
    } catch (_) {
      Toast.show({ type: "error", text1: "Share failed" });
    }
  };

  const escHtml = (s) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const optionalImport = new Function(
        "moduleName",
        "return import(moduleName);",
      );
      const Print = await optionalImport("expo-print").catch(() => null);
      const Sharing = await optionalImport("expo-sharing").catch(() => null);
      if (!Print?.printToFileAsync || !Sharing?.shareAsync) {
        throw new Error("Export dependencies are unavailable");
      }

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;padding:32px;color:#1a1a1a}
  h1{color:#2563EB;font-size:22px;margin-bottom:4px}
  .sub{color:#6B7280;font-size:13px;margin-bottom:20px}
  hr{border:none;border-top:1px solid #E5E7EB;margin:16px 0}
  .label{color:#6B7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-top:12px}
  .value{font-size:15px;font-weight:bold;margin-top:3px}
  .normal{font-weight:normal}
  .row{display:flex;gap:32px}
  .col{flex:1}
  .footer{color:#9CA3AF;font-size:10px;margin-top:32px}
</style></head><body>
  <h1>Complaint Report</h1>
  <p class="sub">Ticket #${escHtml(complaint.ticketId)} &bull; Generated ${new Date().toLocaleString()}</p>
  <hr/>
  <div class="row">
    <div class="col"><p class="label">Status</p><p class="value">${escHtml(complaint.status)}</p></div>
    <div class="col"><p class="label">Priority</p><p class="value">${escHtml(complaint.priority)}</p></div>
    <div class="col"><p class="label">Department</p><p class="value">${escHtml(complaint.department)}</p></div>
  </div>
  <hr/>
  <p class="label">Location</p>
  <p class="value normal">${escHtml(complaint.locationName || "Not specified")}</p>
  <p class="label">Date Submitted</p>
  <p class="value">${new Date(complaint.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
  ${complaint.sla?.dueDate ? `<p class="label">SLA Due Date</p><p class="value">${new Date(complaint.sla.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>` : ""}
  <hr/>
  <p class="label">Description</p>
  <p class="value normal">${escHtml(complaint.refinedText || complaint.rawText || "No description provided")}</p>
  ${complaint.workerNotes ? `<hr/><p class="label">Worker Notes</p><p class="value normal">${escHtml(complaint.workerNotes)}</p>` : ""}
  ${complaint.feedback?.rating ? `<hr/><p class="label">Citizen Feedback</p><p class="value">${complaint.feedback.rating} / 5 ★</p>${complaint.feedback.comment ? `<p class="value normal">${escHtml(complaint.feedback.comment)}</p>` : ""}` : ""}
  <hr/>
  <p class="footer">Generated by Sahayak &bull; Ticket #${escHtml(complaint.ticketId)}</p>
</body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: `Complaint ${complaint.ticketId}.pdf`,
      });
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Export failed",
        text2: e?.message || "Could not generate PDF",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleOpenInMaps = async (latitude, longitude) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (_) {
      Toast.show({
        type: "error",
        text1: t("common.failed"),
        text2: t("complaints.details.couldNotLoad"),
      });
    }
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

  const latitude = Number(complaint?.coordinates?.lat);
  const longitude = Number(complaint?.coordinates?.lng);
  const hasCoordinates =
    Number.isFinite(latitude) && Number.isFinite(longitude);
  const mapEmbedUrl = (() => {
    if (!hasCoordinates) return null;

    const delta = 0.0006;
    const left = longitude - delta;
    const right = longitude + delta;
    const top = latitude + delta;
    const bottom = latitude - delta;

    const bbox = encodeURIComponent(`${left},${bottom},${right},${top}`);
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;
  })();

  const complaintOwnerId = String(
    complaint?.userId?._id || complaint?.userId?.id || complaint?.userId || "",
  );
  const isComplaintOwner =
    !complaintOwnerId || String(currentUserId || "") === complaintOwnerId;

  const showDiscussionThread =
    userRole === "user"
      ? isComplaintOwner
      : userRole === "head" || userRole === "worker" || userRole === "admin";

  const assignedWorkerCount = complaint.assignedWorkers?.length ?? 0;
  const hasAssignedWorkers = assignedWorkerCount > 0;
  const canViewMultiWorkerDetails =
    userRole === "head" || userRole === "worker" || userRole === "admin";
  const showAssignedWorkersSection =
    hasAssignedWorkers &&
    (assignedWorkerCount === 1 || canViewMultiWorkerDetails);
  const showWorkerPhoneDetails =
    assignedWorkerCount > 1 && canViewMultiWorkerDetails;
  const latestHistoryStatus = normalizeStatus(
    complaint.history?.[complaint.history.length - 1]?.status,
  );
  const complaintStatus = normalizeStatus(complaint.status);
  const effectiveActionStatus = CANONICAL_COMPLAINT_STATUSES.includes(
    latestHistoryStatus,
  )
    ? latestHistoryStatus
    : complaintStatus;
  const workerActionStatus = WORKER_ACTIONABLE_STATUSES.includes(
    effectiveActionStatus,
  )
    ? effectiveActionStatus
    : complaintStatus;
  const isCurrentWorkerAssigned =
    userRole === "worker" &&
    (assignedWorkerCount === 0 ||
      (complaint.assignedWorkers || []).some((assignment) => {
        return String(assignment?.workerId || "") === String(currentUserId || "");
      }));
  const hasExplicitLeader = (complaint.assignedWorkers || []).some(
    (assignment) => assignment?.isLeader,
  );
  const currentWorkerAssignment = (complaint.assignedWorkers || []).find(
    (assignment) => String(assignment?.workerId || "") === String(currentUserId || ""),
  );
  const isCurrentWorkerLeader =
    userRole === "worker" &&
    Boolean(
      currentWorkerAssignment &&
        (currentWorkerAssignment?.isLeader ||
          (!hasExplicitLeader &&
            String(
              complaint.assignedWorkers?.[0]?.workerId || "",
            ) === String(currentUserId || ""))),
    );

  const showHeadReviewAction =
    userRole === "head" && effectiveActionStatus === "pending-approval";
  const showHeadManageWorkersAction =
    userRole === "head" &&
    !HEAD_MANAGE_BLOCKED_STATUSES.includes(effectiveActionStatus);
  const showHeadCancelAction =
    showHeadManageWorkersAction && !hasAssignedWorkers;
  const headActionFooterHeight = showHeadReviewAction
    ? 170
    : showHeadManageWorkersAction
      ? showHeadCancelAction
        ? 170
        : 100
      : 0;
  const showWorkerStartWorkAction =
    isCurrentWorkerAssigned &&
    isCurrentWorkerLeader &&
    (workerActionStatus === "assigned" ||
      workerActionStatus === "needs-rework");
  const showWorkerUploadAction =
    isCurrentWorkerAssigned &&
    isCurrentWorkerLeader &&
    workerActionStatus === "in-progress";
  const workerActionFooterHeight =
    showWorkerStartWorkAction || showWorkerUploadAction ? 100 : 0;
  const detailBottomPadding =
    120 + headActionFooterHeight + workerActionFooterHeight;

  const upvoteCount = complaint.upvoteCount || 0;
  const upvoteImpactLabel =
    upvoteCount >= 200
      ? t("complaints.details.eligibleHighPriorityEscalation")
      : upvoteCount >= 100
        ? t("complaints.details.eligibleMediumPriorityEscalation")
        : t("complaints.details.belowEscalationThreshold");
  const nextUpvoteThresholdLabel =
    upvoteCount < 100
      ? t("complaints.details.nextLowToMedium", {
          count: 100 - upvoteCount,
        })
      : upvoteCount < 200
        ? t("complaints.details.nextMediumToHigh", {
            count: 200 - upvoteCount,
          })
        : t("complaints.details.highestThresholdReached");

  const complaintTimelineHistory = (complaint.history || []).map(
    (entry, index) => {
      if (
        entry?.timestamp ||
        entry?.updatedAt ||
        entry?.createdAt ||
        entry?.at
      ) {
        return entry;
      }
      return {
        ...entry,
        timestamp:
          (index === 0 ? complaint.createdAt : complaint.updatedAt) ||
          complaint.createdAt ||
          null,
      };
    },
  );
  const showSatisfactionActions = userRole === "user";

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={t("complaints.details.title")}
        rightElement={
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <TouchableOpacity
              onPress={handleShare}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <Share2 size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleExport}
              disabled={exporting}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              {exporting ? (
                <ActivityIndicator size={14} color={colors.primary} />
              ) : (
                <FileDown size={16} color={colors.primary} />
              )}
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: detailBottomPadding,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refreshComplaint()}
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
              {formatStatusLabel(t, complaint.status)}
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

        {/* HOD: AI Suggestion Review */}
        {userRole === "head" &&
          complaint.aiSuggestedDepartment &&
          (complaint.aiSuggestedDepartment !== complaint.department ||
            complaint.aiAnalysis?.suggestedPriority !== complaint.priority) && (
            <Card
              style={{
                margin: 0,
                marginBottom: 12,
                flex: 0,
                borderWidth: 2,
                borderColor: colors.info,
              }}
            >
              <View className="flex-row items-center mb-3">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: colors.info + "20",
                  }}
                >
                  <AlertCircle size={16} color={colors.info} />
                </View>
                <View className="ml-2 flex-1">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("complaints.details.aiSuggestionAvailable")}
                  </Text>
                  {complaint.aiConfidence && (
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.aiReview.confidence", {
                        pct: Math.round(complaint.aiConfidence * 100),
                      })}
                    </Text>
                  )}
                </View>
              </View>

              {/* Department Suggestion */}
              {complaint.aiSuggestedDepartment !== complaint.department && (
                <View className="mb-3">
                  <View
                    className="rounded-lg p-3"
                    style={{ backgroundColor: colors.backgroundSecondary }}
                  >
                    <Text
                      className="text-xs mb-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("complaints.details.departmentSuggestion")}
                    </Text>
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text
                          className="text-sm"
                          style={{ color: colors.textSecondary }}
                        >
                          {t("complaints.details.currentLabel")}{" "}
                          <Text
                            className="font-semibold"
                            style={{ color: colors.textPrimary }}
                          >
                            {complaint.department}
                          </Text>
                        </Text>
                        <Text
                          className="text-sm mt-1"
                          style={{ color: colors.textSecondary }}
                        >
                          {t("complaints.details.aiSuggestsLabel")}{" "}
                          <Text
                            className="font-semibold"
                            style={{ color: colors.success }}
                          >
                            {complaint.aiSuggestedDepartment}
                          </Text>
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleApplyAISuggestion(true, false)}
                        className="px-4 py-2 rounded-lg"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: colors.light }}
                        >
                          {t("common.apply")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Priority Suggestion */}
              {complaint.aiAnalysis?.suggestedPriority &&
                complaint.aiAnalysis.suggestedPriority !==
                  complaint.priority && (
                  <View className="mb-3">
                    <View
                      className="rounded-lg p-3"
                      style={{ backgroundColor: colors.backgroundSecondary }}
                    >
                      <Text
                        className="text-xs mb-2"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("complaints.details.prioritySuggestion")}
                      </Text>
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text
                            className="text-sm"
                            style={{ color: colors.textSecondary }}
                          >
                            {t("complaints.details.currentLabel")}{" "}
                            <Text
                              className="font-semibold"
                              style={{ color: colors.textPrimary }}
                            >
                              {complaint.priority}
                            </Text>
                          </Text>
                          <Text
                            className="text-sm mt-1"
                            style={{ color: colors.textSecondary }}
                          >
                            {t("complaints.details.aiSuggestsLabel")}{" "}
                            <Text
                              className="font-semibold"
                              style={{ color: colors.warning }}
                            >
                              {complaint.aiAnalysis.suggestedPriority}
                            </Text>
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleApplyAISuggestion(false, true)}
                          className="px-4 py-2 rounded-lg"
                          style={{ backgroundColor: colors.primary }}
                        >
                          <Text className="text-sm font-semibold text-white">
                            {t("common.apply")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

              {/* AI Reasoning */}
              {complaint.aiAnalysis?.reasoning && (
                <View
                  className="rounded-lg p-3"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <Text
                    className="text-xs mb-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("complaints.details.aiReasoning")}
                  </Text>
                  <Text
                    className="text-sm"
                    style={{ color: colors.textPrimary }}
                  >
                    {complaint.aiAnalysis.reasoning}
                  </Text>
                </View>
              )}

              {/* Sentiment & Urgency */}
              {complaint.aiAnalysis && (
                <View className="flex-row mt-3 space-x-2">
                  {complaint.aiAnalysis.sentiment && (
                    <View
                      className="flex-1 rounded-lg p-2"
                      style={{ backgroundColor: colors.backgroundSecondary }}
                    >
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("complaints.details.sentiment")}
                      </Text>
                      <Text
                        className="text-sm font-semibold capitalize"
                        style={{ color: colors.textPrimary }}
                      >
                        {complaint.aiAnalysis.sentiment}
                      </Text>
                    </View>
                  )}
                  {complaint.aiAnalysis.urgency && (
                    <View
                      className="flex-1 rounded-lg p-2 ml-2"
                      style={{ backgroundColor: colors.backgroundSecondary }}
                    >
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("complaints.details.urgency")}
                      </Text>
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.textPrimary }}
                      >
                        {complaint.aiAnalysis.urgency}/10
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Keywords */}
              {complaint.aiAnalysis?.keywords &&
                complaint.aiAnalysis.keywords.length > 0 && (
                  <View
                    className="rounded-lg p-3 mt-3"
                    style={{ backgroundColor: colors.backgroundSecondary }}
                  >
                    <Text
                      className="text-xs mb-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("complaints.details.keywords")}
                    </Text>
                    <View className="flex-row flex-wrap gap-1">
                      {complaint.aiAnalysis.keywords.map((kw, i) => (
                        <View
                          key={i}
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: colors.info + "18" }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{ color: colors.info }}
                          >
                            {kw}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

              {/* Affected Count */}
              {complaint.aiAnalysis?.affectedCount != null && (
                <View
                  className="flex-row items-center mt-3 rounded-lg p-3"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <Users size={14} color={colors.muted} />
                  <Text
                    className="text-xs ml-1.5"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("complaints.details.estimatedAffected")}{" "}
                    <Text
                      className="font-semibold"
                      style={{ color: colors.textPrimary }}
                    >
                      ~{complaint.aiAnalysis.affectedCount}{" "}
                      {t("complaints.details.people")}
                    </Text>
                  </Text>
                </View>
              )}
            </Card>
          )}

        {userRole === "worker" &&
          complaint.status === "needs-rework" &&
          complaint.reworkReason && (
            <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
              <View className="flex-row items-center mb-2">
                <AlertCircle size={18} color={colors.warning} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.details.reworkInstructions")}
                </Text>
              </View>
              <Text className="text-sm" style={{ color: colors.textPrimary }}>
                {String(complaint.reworkReason || "").replace(
                  /^Marked as needs-rework by HOD:\s*/,
                  "",
                )}
              </Text>
            </Card>
          )}

        {showAssignedWorkersSection && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Users size={18} color={colors.primary} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.details.assignedWorkersTitle", {
                    count: assignedWorkerCount,
                  })}
                </Text>
              </View>
              {userRole === "worker" && !isCurrentWorkerLeader && (
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: colors.warning + "20" }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: colors.warning }}
                  >
                    {t("complaints.details.leaderControlsStatus")}
                  </Text>
                </View>
              )}
            </View>

            {(complaint.assignedWorkers || []).map((assignment, index) => (
              <View key={`${assignment.workerId}-${index}`}>
                {index > 0 && (
                  <View
                    className="h-[1px] my-3"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center flex-wrap">
                      <Text
                        className="text-base font-semibold"
                        style={{ color: colors.textPrimary }}
                      >
                        {assignment.workerName || t("complaints.details.assignedWorker")}
                      </Text>
                      {assignedWorkerCount > 1 && assignment.isLeader && (
                        <View
                          className="ml-2 px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: colors.primary + "18" }}
                        >
                          <Text
                            className="text-[10px] font-bold"
                            style={{ color: colors.primary }}
                          >
                            {t("complaints.details.leaderBadge")}
                          </Text>
                        </View>
                      )}
                    </View>
                    {showWorkerPhoneDetails && assignment.workerPhone ? (
                      <View className="flex-row items-center mt-2">
                        <MaterialIcons
                          name="phone"
                          size={13}
                          color={colors.textSecondary}
                        />
                        <Text
                          className="text-xs ml-1"
                          style={{ color: colors.textSecondary }}
                        >
                          {assignment.workerPhone}
                        </Text>
                      </View>
                    ) : null}
                    {assignment.taskDescription ? (
                      <Text
                        className="text-sm mt-2 leading-5"
                        style={{ color: colors.textPrimary }}
                      >
                        {assignment.taskDescription}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
          </Card>
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
                {t("complaints.details.complaintTitle")}
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

          {/* Tags */}
          {complaint.tags && complaint.tags.length > 0 && (
            <>
              <View
                className="h-[1px] mt-3 mb-3"
                style={{ backgroundColor: colors.border }}
              />
              <View className="flex-row items-center mb-2">
                <Tag size={14} color={colors.muted} />
                <Text className="text-xs ml-1" style={{ color: colors.muted }}>
                  {t("complaints.details.tags")}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-1">
                {complaint.tags.map((tag, i) => (
                  <View
                    key={i}
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: colors.primary + "18" }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: colors.primary }}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </Card>

        {/* Community Upvote + Chat (side by side) */}
        {userRole === "user" && (
          <View className={showDiscussionThread ? "flex-row mb-3" : "mb-3"}>
            <View
              style={{ flex: 1, marginRight: showDiscussionThread ? 6 : 0 }}
            >
              <PressableBlock onPress={handleUpvote} disabled={upvoting}>
                <Card
                  style={{
                    margin: 0,
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
                        color={
                          hasUpvoted ? colors.primary : colors.textSecondary
                        }
                        fill={hasUpvoted ? colors.primary : "transparent"}
                      />
                      <View className="ml-3 flex-1">
                        <Text
                          className="text-base font-semibold"
                          style={{
                            color: hasUpvoted
                              ? colors.primary
                              : colors.textPrimary,
                          }}
                        >
                          {hasUpvoted
                            ? t("complaints.details.upvoted")
                            : t("complaints.details.upvote")}
                        </Text>
                        <Text
                          className="text-sm mt-0.5"
                          style={{ color: colors.textSecondary }}
                        >
                          {upvoteCount}{" "}
                          {(complaint.upvoteCount || 0) === 1
                            ? t("complaints.details.personAffected")
                            : t("complaints.details.peopleAffected")}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center">
                      {upvoting && (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      )}
                      <TouchableOpacity
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          setUpvoteInfoModalVisible(true);
                        }}
                        className="w-8 h-8 items-center justify-center ml-2"
                      >
                        <Info size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              </PressableBlock>
            </View>

            {showDiscussionThread && (
              <Card
                style={{
                  margin: 0,
                  marginLeft: 6,
                  flex: 0,
                  flexGrow: 0,
                  flexBasis: "auto",
                  width: 104,
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/complaints/complaint-chat",
                      params: { id, ticketId: complaint.ticketId },
                    })
                  }
                  className="py-3 px-2 items-center justify-center"
                >
                  <MessageSquare size={18} color={colors.primary} />
                  <Text
                    className="text-sm font-semibold mt-1"
                    style={{ color: colors.primary }}
                  >
                    {t("complaints.details.openChat")}
                  </Text>
                </TouchableOpacity>
              </Card>
            )}
          </View>
        )}

        {(userRole === "head" || userRole === "worker") && (
          <View className={showDiscussionThread ? "flex-row mb-3" : "mb-3"}>
            <Card
              style={{
                margin: 0,
                marginRight: showDiscussionThread ? 6 : 0,
                flex: 1,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ThumbsUp size={20} color={colors.primary} />
                  <Text
                    className="text-base font-semibold ml-2"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("complaints.details.communityUpvotes")}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setUpvoteInfoModalVisible(true)}
                  className="w-8 h-8 items-center justify-center"
                >
                  <Info size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text
                className="text-sm mt-2"
                style={{ color: colors.textSecondary }}
              >
                {upvoteCount}{" "}
                {(complaint.upvoteCount || 0) === 1
                  ? t("complaints.details.personAffected")
                  : t("complaints.details.peopleAffected")}
              </Text>
            </Card>

            {showDiscussionThread && (
              <Card
                style={{
                  margin: 0,
                  marginLeft: 6,
                  flex: 0,
                  flexGrow: 0,
                  flexBasis: "auto",
                  width: 104,
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/complaints/complaint-chat",
                      params: { id, ticketId: complaint.ticketId },
                    })
                  }
                  className="py-3 px-2 items-center justify-center"
                >
                  <MessageSquare size={18} color={colors.primary} />
                  <Text
                    className="text-sm font-semibold mt-1"
                    style={{ color: colors.primary }}
                  >
                    {t("complaints.details.openChat")}
                  </Text>
                </TouchableOpacity>
              </Card>
            )}
          </View>
        )}

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
              {hasCoordinates && (
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.textSecondary }}
                >
                  {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </Text>
              )}

              {hasCoordinates && mapEmbedUrl && (
                <Pressable
                  onPress={() => handleOpenInMaps(latitude, longitude)}
                  className="mt-3 overflow-hidden rounded-xl"
                  style={{
                    height: 220,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                  }}
                >
                  <WebView
                    source={{ uri: mapEmbedUrl }}
                    style={{ flex: 1 }}
                    pointerEvents="none"
                    javaScriptEnabled
                    domStorageEnabled
                    startInLoadingState
                    renderLoading={() => (
                      <View
                        className="absolute inset-0 items-center justify-center"
                        style={{
                          backgroundColor: colors.backgroundSecondary,
                        }}
                      >
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      </View>
                    )}
                  />

                  <View
                    pointerEvents="none"
                    className="absolute inset-0 items-center justify-center"
                  >
                    <MaterialIcons
                      name="location-on"
                      size={42}
                      color={colors.primary}
                      style={{
                        textShadowColor: colors.dark + "2E",
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 2,
                      }}
                    />
                  </View>

                  <View
                    pointerEvents="none"
                    className="absolute right-3 bottom-3 px-3.5 py-2 rounded-xl flex-row items-center"
                    style={{
                      backgroundColor: colors.primary,
                    }}
                  >
                    <MaterialIcons
                      name="place"
                      size={14}
                      color={colors.light}
                    />
                    <Text
                      className="text-xs font-bold ml-1.5"
                      style={{ color: colors.light }}
                    >
                      {t("complaints.details.openInMaps")}
                    </Text>
                  </View>
                </Pressable>
              )}
            </View>
          </View>
        </Card>

        {/* SLA Status Card */}
        {complaint.sla && complaint.sla.dueDate && (
          <Card
            style={{
              margin: 0,
              marginBottom: 12,
              flex: 0,
              borderWidth: 1.5,
              borderColor:
                complaint.sla.isOverdue || slaCountdown?.isOverdue
                  ? colors.danger
                  : slaCountdown?.isCritical
                    ? colors.danger
                    : slaCountdown?.isUrgent
                      ? colors.warning
                      : colors.border,
            }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <ShieldAlert
                  size={18}
                  color={
                    complaint.sla.isOverdue || slaCountdown?.isOverdue
                      ? colors.danger
                      : slaCountdown?.isCritical
                        ? colors.danger
                        : slaCountdown?.isUrgent
                          ? colors.warning
                          : colors.success
                  }
                />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.details.sla.title")}
                </Text>
              </View>

              {/* Escalation level badge */}
              {(complaint.sla.escalationLevel || 0) > 0 && (
                <View
                  className="flex-row items-center px-2 py-1 rounded-lg"
                  style={{ backgroundColor: colors.warning + "22" }}
                >
                  <ChevronUp size={12} color={colors.warning} />
                  <Text
                    className="text-xs font-bold ml-1"
                    style={{ color: colors.warning }}
                  >
                    {t("complaints.details.sla.level")}{" "}
                    {complaint.sla.escalationLevel}
                  </Text>
                </View>
              )}
            </View>

            {/* Due Date row */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {t("complaints.details.sla.dueDate")}
              </Text>
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {new Date(complaint.sla.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>

            <View
              className="h-[1px] mb-2"
              style={{ backgroundColor: colors.border }}
            />

            {/* Overdue / Countdown row */}
            <View className="flex-row items-center justify-between">
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {complaint.sla.isOverdue || slaCountdown?.isOverdue
                  ? t("complaints.details.sla.status")
                  : t("complaints.details.sla.timeLeft")}
              </Text>

              {complaint.sla.isOverdue || slaCountdown?.isOverdue ? (
                <View
                  className="flex-row items-center px-3 py-1 rounded-lg"
                  style={{ backgroundColor: colors.danger + "22" }}
                >
                  <AlertTriangle size={14} color={colors.danger} />
                  <Text
                    className="text-sm font-bold ml-1.5"
                    style={{ color: colors.danger }}
                  >
                    {t("complaints.details.sla.overdue")}
                  </Text>
                </View>
              ) : slaCountdown ? (
                <View
                  className="flex-row items-center px-3 py-1 rounded-lg"
                  style={{
                    backgroundColor: slaCountdown.isCritical
                      ? colors.danger + "22"
                      : slaCountdown.isUrgent
                        ? colors.warning + "22"
                        : colors.success + "22",
                  }}
                >
                  <Clock
                    size={14}
                    color={
                      slaCountdown.isCritical
                        ? colors.danger
                        : slaCountdown.isUrgent
                          ? colors.warning
                          : colors.success
                    }
                  />
                  <Text
                    className="text-sm font-bold ml-1.5"
                    style={{
                      color: slaCountdown.isCritical
                        ? colors.danger
                        : slaCountdown.isUrgent
                          ? colors.warning
                          : colors.success,
                    }}
                  >
                    {slaCountdown.text}
                  </Text>
                </View>
              ) : (
                <View
                  className="px-3 py-1 rounded-lg"
                  style={{ backgroundColor: colors.success + "22" }}
                >
                  <Text
                    className="text-sm font-bold"
                    style={{ color: colors.success }}
                  >
                    {t("complaints.details.sla.onTime")}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Proof Image */}
        {complaint.proofImage && complaint.proofImage.length > 0 && (
            <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
              <View className="flex-row items-center mb-3">
                <ImageIcon size={20} color={colors.primary} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {complaint.proofImage.length > 1
                    ? t("complaints.details.proofImages")
                    : t("complaints.details.proofImage")}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {complaint.proofImage.map((img, idx) => (
                  <Pressable
                    key={`${idx}-${img}`}
                    onPress={() => openImagePreview(img)}
                    style={{ marginRight: 8 }}
                  >
                    <Image
                      source={{ uri: img }}
                      className="w-32 h-32 rounded-xl"
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </Card>
          )}

        {/* Completion Photos (Before/After) - Visible to all roles */}
        {complaint.completionPhotos &&
          complaint.completionPhotos.length > 0 && (
            <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
              <View className="flex-row items-center mb-3">
                <ImageIcon size={20} color={colors.success} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.details.completionPhotos")}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {complaint.completionPhotos.map((img, idx) => (
                  <Pressable
                    key={`${idx}-${img}`}
                    onPress={() => openImagePreview(img)}
                    style={{ marginRight: 8 }}
                  >
                    <Image
                      source={{ uri: img }}
                      className="w-32 h-32 rounded-xl"
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </Card>
          )}

        {/* Satisfaction Voting - Only for resolved complaints */}
        {complaint.status === "resolved" && satisfactionVotes && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <View className="mb-3">
              <Text
                className="text-base font-semibold mb-2"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.details.satisfactionVote")}
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {t("complaints.details.satisfactionVoteDesc")}
              </Text>
            </View>

            <View className="flex-row items-center justify-around mb-4">
              <Pressable
                onPress={() => handleSatisfactionVote("up")}
                disabled={votingInProgress || !showSatisfactionActions}
                className="flex-1 mr-2 py-4 rounded-xl items-center"
                style={{
                  backgroundColor:
                    satisfactionVotes.userVote === "up"
                      ? colors.success
                      : colors.backgroundSecondary,
                  opacity: votingInProgress || !showSatisfactionActions ? 0.5 : 1,
                }}
              >
                <ThumbsUp
                  size={28}
                  color={
                    satisfactionVotes.userVote === "up"
                      ? colors.light
                      : colors.textPrimary
                  }
                />
                <Text
                  className="text-lg font-bold mt-2"
                  style={{
                    color:
                      satisfactionVotes.userVote === "up"
                        ? colors.light
                        : colors.textPrimary,
                  }}
                >
                  {satisfactionVotes.thumbsUpCount || 0}
                </Text>
                <Text
                  className="text-xs mt-1"
                  style={{
                    color:
                      satisfactionVotes.userVote === "up"
                        ? colors.light
                        : colors.textSecondary,
                  }}
                >
                  {t("complaints.details.satisfied")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleSatisfactionVote("down")}
                disabled={votingInProgress || !showSatisfactionActions}
                className="flex-1 ml-2 py-4 rounded-xl items-center"
                style={{
                  backgroundColor:
                    satisfactionVotes.userVote === "down"
                      ? colors.danger
                      : colors.backgroundSecondary,
                  opacity: votingInProgress || !showSatisfactionActions ? 0.5 : 1,
                }}
              >
                <ThumbsDown
                  size={28}
                  color={
                    satisfactionVotes.userVote === "down"
                      ? colors.light
                      : colors.textPrimary
                  }
                />
                <Text
                  className="text-lg font-bold mt-2"
                  style={{
                    color:
                      satisfactionVotes.userVote === "down"
                        ? colors.light
                        : colors.textPrimary,
                  }}
                >
                  {satisfactionVotes.thumbsDownCount || 0}
                </Text>
                <Text
                  className="text-xs mt-1"
                  style={{
                    color:
                      satisfactionVotes.userVote === "down"
                        ? colors.light
                        : colors.textSecondary,
                  }}
                >
                  {t("complaints.details.notSatisfied")}
                </Text>
              </Pressable>
            </View>

            {!showSatisfactionActions && (
              <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
                Satisfaction voting is available only for citizens.
              </Text>
            )}

            {/* Satisfaction percentage bar */}
            {(() => {
              const upCount = satisfactionVotes.thumbsUpCount || 0;
              const downCount = satisfactionVotes.thumbsDownCount || 0;
              const total = upCount + downCount;
              if (total === 0) return null;
              const upPct = Math.round((upCount / total) * 100);
              const downPct = 100 - upPct;
              return (
                <View className="mb-3">
                  <View className="flex-row items-center mb-1.5">
                    <Text
                      className="text-xs font-bold w-10 text-right"
                      style={{ color: colors.success }}
                    >
                      {upPct}%
                    </Text>
                    <View
                      className="flex-1 mx-2 rounded-full overflow-hidden"
                      style={{
                        height: 8,
                        backgroundColor: colors.backgroundSecondary,
                      }}
                    >
                      <View
                        style={{
                          width: `${upPct}%`,
                          height: 8,
                          backgroundColor: colors.success,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                    <Text
                      className="text-xs font-bold w-10"
                      style={{ color: colors.danger }}
                    >
                      {downPct}%
                    </Text>
                  </View>
                  <Text
                    className="text-xs text-center"
                    style={{ color: colors.textSecondary }}
                  >
                    {total} {total === 1 ? "vote" : "votes"} total
                  </Text>
                </View>
              );
            })()}

            {satisfactionVotes.userVote && (
              <View
                className="py-2 px-3 rounded-lg"
                style={{ backgroundColor: colors.backgroundSecondary }}
              >
                <Text
                  className="text-xs text-center"
                  style={{ color: colors.textSecondary }}
                >
                  {t("complaints.details.yourVoteRecorded")}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Escalation History — only shown when escalations occurred */}
        {complaint.sla?.escalationHistory &&
          complaint.sla.escalationHistory.length > 0 && (
            <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
              <View className="flex-row items-center mb-3">
                <ShieldAlert size={18} color={colors.warning} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.details.sla.escalationHistory")}
                </Text>
                <View
                  className="ml-2 px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.warning + "22" }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: colors.warning }}
                  >
                    {complaint.sla.escalationHistory.length}
                  </Text>
                </View>
              </View>

              {complaint.sla.escalationHistory.map((entry, index) => (
                <View key={index}>
                  {index > 0 && (
                    <View
                      className="h-[1px] my-2"
                      style={{ backgroundColor: colors.border }}
                    />
                  )}
                  <View className="flex-row items-start">
                    <View
                      className="px-2 py-0.5 rounded-md mr-3 mt-0.5"
                      style={{ backgroundColor: colors.warning + "22" }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: colors.warning }}
                      >
                        L{entry.level}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.textPrimary }}
                      >
                        {t("complaints.details.sla.level")} {entry.level}{" "}
                        {t("complaints.details.sla.escalation")}
                      </Text>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: colors.textSecondary }}
                      >
                        {formatHistoryDate(entry.escalatedAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          )}

        {/* Worker Notes - Visible to HOD and Worker */}
        {(userRole === "head" || userRole === "worker") &&
          complaint.workerNotes && (
            <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
              <View className="flex-row items-center mb-3">
                <FileText size={18} color={colors.textSecondary} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.details.workerNotes")}
                </Text>
              </View>
              <Text
                className="text-sm leading-relaxed"
                style={{ color: colors.textPrimary }}
              >
                {complaint.workerNotes}
              </Text>
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
                <Star size={18} color={colors.warning} fill={colors.warning} />
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
          isComplaintOwner &&
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
                      style={{ color: colors.light }}
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

        {/* Complaint Timeline */}
        {complaint.history && complaint.history.length > 0 && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <Text
              className="text-base font-semibold mb-4"
              style={{ color: colors.textPrimary }}
            >
              {t("complaints.details.complaintTimeline")}
            </Text>
            <ComplaintTimeline
              history={complaintTimelineHistory}
              colors={colors}
              t={t}
            />
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
                    style={{ color: colors.warning }}
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
      </ScrollView>

      {showHeadReviewAction && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.backgroundPrimary,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 10),
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <PressableBlock
            onPress={() => setApprovalModalVisible(true)}
            disabled={approving}
          >
            <Card
              style={{
                margin: 0,
                marginBottom: 10,
                flex: 0,
                backgroundColor: colors.danger,
              }}
            >
              <View className="flex-row items-center justify-center">
                <RotateCcw size={20} color={colors.light} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.light }}
                >
                  {t("complaints.details.requestRework")}
                </Text>
              </View>
            </Card>
          </PressableBlock>

          <PressableBlock
            onPress={handleApproveCompletion}
            disabled={approving}
          >
            <Card
              style={{
                margin: 0,
                flex: 0,
                backgroundColor: colors.success,
              }}
            >
              <View className="flex-row items-center justify-center">
                {approving ? (
                  <ActivityIndicator size="small" color={colors.light} />
                ) : (
                  <>
                    <CheckCircle size={20} color={colors.light} />
                    <Text
                      className="text-base font-semibold ml-2"
                      style={{ color: colors.light }}
                    >
                      {t("complaints.details.closeComplaint")}
                    </Text>
                  </>
                )}
              </View>
            </Card>
          </PressableBlock>
        </View>
      )}

      {showHeadManageWorkersAction && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.backgroundPrimary,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 10),
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <PressableBlock
            onPress={() =>
              router.push({
                pathname: "/(app)/hod/worker-assignment",
                params: { complaintId: id },
              })
            }
          >
            <Card
              style={{
                margin: 0,
                marginBottom: showHeadCancelAction ? 10 : 0,
                flex: 0,
                backgroundColor: colors.primary,
              }}
            >
              <View className="flex-row items-center justify-center">
                <Users size={20} color={colors.light} />
                <Text
                  className="text-base font-semibold ml-2"
                  style={{ color: colors.light }}
                >
                  {hasAssignedWorkers
                    ? t("complaints.details.manageWorkers")
                    : t("complaints.details.assignToWorker")}
                </Text>
              </View>
            </Card>
          </PressableBlock>

          {showHeadCancelAction && (
            <PressableBlock
              onPress={() => setCancelModalVisible(true)}
              disabled={cancelling}
            >
              <Card
                style={{
                  margin: 0,
                  flex: 0,
                  backgroundColor: colors.danger,
                }}
              >
                <View className="flex-row items-center justify-center">
                  {cancelling ? (
                    <ActivityIndicator size="small" color={colors.light} />
                  ) : (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: colors.light }}
                    >
                      {t("complaints.details.cancelComplaint")}
                    </Text>
                  )}
                </View>
              </Card>
            </PressableBlock>
          )}
        </View>
      )}

      {(showWorkerStartWorkAction || showWorkerUploadAction) && (
        <SafeAreaView
          edges={["bottom"]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.backgroundPrimary,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View
            style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 }}
          >
            <PressableBlock
              onPress={
                showWorkerStartWorkAction
                  ? handleStartWork
                  : () => setPhotoUploadModalVisible(true)
              }
              disabled={showWorkerStartWorkAction ? startingWork : false}
            >
              <Card
                style={{
                  margin: 0,
                  flex: 0,
                  backgroundColor: showWorkerStartWorkAction
                    ? colors.primary
                    : colors.success,
                }}
              >
                <View className="flex-row items-center justify-center">
                  {showWorkerStartWorkAction ? (
                    startingWork ? (
                      <ActivityIndicator size="small" color={colors.light} />
                    ) : (
                      <Clock size={20} color={colors.light} />
                    )
                  ) : (
                    <Upload size={20} color={colors.light} />
                  )}
                  <Text
                    className="text-base font-semibold ml-2"
                    style={{ color: colors.light }}
                  >
                    {showWorkerStartWorkAction
                      ? t("complaints.details.startWork")
                      : t("complaints.details.uploadTaskCompletionPhoto")}
                  </Text>
                </View>
              </Card>
            </PressableBlock>
          </View>
        </SafeAreaView>
      )}

      {/* Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImagePreview}
      >
        <View
          className="flex-1"
          style={{ backgroundColor: colors.dark + "F2" }}
        >
          <View className="flex-1 justify-center items-center">
            <Pressable
              onPress={closeImagePreview}
              className="absolute top-12 right-4 z-10 w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <X size={22} color={colors.light} />
            </Pressable>
            {!!previewImageUri && (
              <Image
                key={previewImageUri}
                source={{ uri: previewImageUri }}
                className="w-full h-full"
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={upvoteInfoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUpvoteInfoModalVisible(false)}
      >
        <View
          className="flex-1 justify-center px-5"
          style={{ backgroundColor: colors.dark + "73" }}
        >
          <View
            className="rounded-2xl p-5"
            style={{ backgroundColor: colors.backgroundPrimary }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text
                className="text-lg font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.details.upvotesPriorityTitle")}
              </Text>
              <TouchableOpacity
                onPress={() => setUpvoteInfoModalVisible(false)}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.backgroundSecondary }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              className="text-sm mb-3"
              style={{ color: colors.textSecondary }}
            >
              {t("complaints.details.currentUpvotesStatus", {
                count: upvoteCount,
                status: upvoteImpactLabel,
              })}
            </Text>

            <Text
              className="text-sm"
              style={{ color: colors.textPrimary, lineHeight: 20 }}
            >
              {t("complaints.details.upvotesPriorityDescription")}
            </Text>

            <Text
              className="text-sm mt-2"
              style={{ color: colors.textSecondary }}
            >
              {nextUpvoteThresholdLabel}
            </Text>

            <View className="mt-3">
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {t("complaints.details.lowToMediumAt100")}
              </Text>
              <Text
                className="text-sm mt-1"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.details.mediumToHighAt200")}
              </Text>
              <Text
                className="text-sm mt-2"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.details.noAutoDowngradeFromUpvotes")}
              </Text>
            </View>
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
            style={{ backgroundColor: colors.dark + "80" }}
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
                    <ActivityIndicator size="small" color={colors.light} />
                  ) : (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: colors.light }}
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

      {/* Worker: Photo Upload Modal */}
      {userRole === "worker" && (
        <Modal
          visible={photoUploadModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setPhotoUploadModalVisible(false);
            setSelectedPhotos([]);
          }}
        >
          <View
            className="flex-1 justify-end"
            style={{ backgroundColor: colors.dark + "80" }}
          >
            <SafeAreaView
              edges={["bottom"]}
              className="rounded-t-3xl"
              style={{ backgroundColor: colors.backgroundPrimary }}
            >
              <View className="p-6">
                <Text
                  className="text-xl font-bold mb-4 text-center"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.details.uploadTaskCompletionPhoto")}
                </Text>

                <Text
                  className="text-sm mb-6 text-center"
                  style={{ color: colors.textSecondary }}
                >
                  {t("complaints.details.uploadAfterPhotosDesc")}
                </Text>

                <View className="mb-5">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 4 }}
                  >
                    {selectedPhotos.map((photo, index) => (
                      <View
                        key={`${photo?.uri || "photo"}-${index}`}
                        style={{ marginRight: 12 }}
                      >
                        <View
                          style={{
                            width: 120,
                            height: 120,
                            borderWidth: 2,
                            borderColor: colors.primary,
                            borderRadius: 12,
                            overflow: "hidden",
                          }}
                        >
                          <Image
                            source={{ uri: photo?.uri }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="cover"
                          />
                          <Pressable
                            onPress={() => removeSelectedPhoto(index)}
                            disabled={uploadingPhotos}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.dark + "B3" }}
                          >
                            <X size={14} color={colors.light} />
                          </Pressable>
                        </View>
                      </View>
                    ))}

                    {selectedPhotos.length < 5 && (
                      <Pressable
                        onPress={takePhoto}
                        disabled={uploadingPhotos}
                        style={{
                          width: 120,
                          height: 120,
                          borderWidth: 2,
                          borderStyle: "dashed",
                          borderColor: colors.primary,
                          borderRadius: 12,
                          justifyContent: "center",
                          alignItems: "center",
                          backgroundColor: "transparent",
                          opacity: uploadingPhotos ? 0.7 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 34, color: colors.primary }}>
                          +
                        </Text>
                      </Pressable>
                    )}
                  </ScrollView>
                </View>

                <View className="mb-4">
                  <Pressable
                    onPress={handleUploadFromModal}
                    disabled={uploadingPhotos || !selectedPhotos?.length}
                    className="flex-row items-center justify-center py-4 rounded-xl"
                    style={{
                      backgroundColor: colors.primary,
                      opacity:
                        uploadingPhotos || !selectedPhotos?.length ? 0.5 : 1,
                    }}
                  >
                    {uploadingPhotos ? (
                      <>
                        <ActivityIndicator size="small" color={colors.light} />
                        <Text
                          className="text-base font-semibold ml-2"
                          style={{ color: colors.light }}
                        >
                          {t("complaints.details.uploading")}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Upload size={24} color={colors.light} />
                        <Text
                          className="text-base font-semibold ml-2"
                          style={{ color: colors.light }}
                        >
                          {t("complaints.details.upload")}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => {
                    setPhotoUploadModalVisible(false);
                    setSelectedPhotos([]);
                  }}
                  disabled={uploadingPhotos}
                  className="py-3 rounded-xl items-center"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    opacity: uploadingPhotos ? 0.5 : 1,
                  }}
                >
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("common.cancel")}
                  </Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {/* HOD: Cancel Confirmation Modal */}
      {userRole === "head" && (
        <DialogBox
          visible={cancelModalVisible}
          onClose={closeCancelModal}
          onCancel={closeCancelModal}
          onConfirm={handleCancelComplaint}
          title={t("complaints.details.cancelConfirmationTitle")}
          message={`${t("complaints.details.cancelConfirmationMessage")}\n\n${t("complaints.details.cancelReasonLabel")}`}
          showInput
          inputPlaceholder={t("complaints.details.cancelReasonPlaceholder")}
          inputValue={cancelReason}
          onInputChange={setCancelReason}
          confirmText={t("complaints.details.confirmCancel")}
          cancelText={t("common.cancel")}
          loading={cancelling}
          titleAlign="center"
          messageAlign="left"
          confirmButtonStyle={{ backgroundColor: colors.danger }}
          confirmTextStyle={{ color: colors.light }}
        />
      )}

      {userRole === "head" && (
        <Modal
          visible={approvalModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setApprovalModalVisible(false)}
        >
          <View
            className="flex-1 justify-end"
            style={{ backgroundColor: colors.dark + "80" }}
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
                    backgroundColor: colors.danger,
                    opacity: sendingRework || !reworkReason.trim() ? 0.5 : 1,
                  }}
                >
                  {sendingRework ? (
                    <ActivityIndicator size="small" color={colors.light} />
                  ) : (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: colors.light }}
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

export default function ComplaintDetails() {
  return (
    <ErrorBoundary>
      <ComplaintDetailsInner />
    </ErrorBoundary>
  );
}
