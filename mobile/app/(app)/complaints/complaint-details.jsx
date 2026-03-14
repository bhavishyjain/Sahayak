import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
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
  Star,
  Tag,
  ThumbsDown,
  ThumbsUp,
  User,
  Users,
  Upload,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
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
import PressableBlock from "../../../components/PressableBlock";
import {
  GET_COMPLAINT_BY_ID_URL,
  UPVOTE_COMPLAINT_URL,
  SUBMIT_FEEDBACK_URL,
  HOD_APPROVE_COMPLETION_URL,
  HOD_NEEDS_REWORK_URL,
  HOD_CANCEL_COMPLAINT_URL,
  UPDATE_COMPLAINT_STATUS_URL,
  UPLOAD_COMPLETION_PHOTOS_URL,
  SATISFACTION_VOTE_URL,
  GET_SATISFACTION_URL,
  APPLY_AI_SUGGESTION_URL,
} from "../../../url";
import apiCall from "../../../utils/api";
import { getStatusColor, getPriorityColor } from "../../../utils/colorHelpers";
import { getSlaCountdown } from "../../../utils/complaintFormatters";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";
import {
  cacheComplaintDetail,
  getCachedComplaintDetail,
} from "../../../utils/complaintsCache";
import ErrorBoundary from "../../../components/ErrorBoundary";

function ComplaintDetailsInner() {
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
  const [photoUploadModalVisible, setPhotoUploadModalVisible] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Satisfaction voting states
  const [satisfactionVotes, setSatisfactionVotes] = useState(null);
  const [votingInProgress, setVotingInProgress] = useState(false);

  // Common states
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [upvoteInfoModalVisible, setUpvoteInfoModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      // Persist for offline fallback
      if (complaintData) await cacheComplaintDetail(id, complaintData);
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

      // Fetch satisfaction votes for resolved complaints
      if (complaintData?.status === "resolved") {
        await fetchSatisfactionVotes();
      }
    } catch (e) {
      // Try to serve cached version on network failure
      const cached = await getCachedComplaintDetail(id);
      if (cached) {
        setComplaint(cached);
        const user = await getUserAuth();
        setUserRole(user?.role);
        setCurrentUserId(String(user?.id || user?._id));
      } else {
        Toast.show({
          type: "error",
          text1: t("common.failed"),
          text2:
            e?.response?.data?.message || t("complaints.details.couldNotLoad"),
        });
        if (e?.response?.status === 404) {
          setTimeout(() => router.back(), 1500);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      load(false);
    }
  }, [id]);

  // Auto-refresh when a push notification arrives that relates to this complaint
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification?.request?.content?.data;
        // Backend sends `complaintId` in the notification payload
        if (data?.complaintId && String(data.complaintId) === String(id)) {
          load(true);
        }
      },
    );
    return () => sub.remove();
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
          ? t("complaints.details.upvoteRemovedMessage")
          : t("complaints.details.thanksForUpvoting"),
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

  // HOD: Apply AI Suggestion
  const handleApplyAISuggestion = async (applyDepartment, applyPriority) => {
    try {
      await apiCall({
        method: "POST",
        url: APPLY_AI_SUGGESTION_URL(id),
        data: { applyDepartment, applyPriority },
      });

      Toast.show({
        type: "success",
        text1: t("complaints.details.aiSuggestionApplied"),
        text2: t("complaints.details.complaintUpdated"),
      });

      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("complaints.details.updateFailed"),
        text2:
          e?.response?.data?.message || t("complaints.details.couldNotApplyAI"),
      });
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

  // Worker: Pick photos from gallery
  const pickPhotosFromGallery = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: t("complaints.permissionRequired"),
          text2: t("complaints.galleryPermissionDenied"),
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        aspect: [4, 3],
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets) {
        setSelectedPhotos(result.assets);
        setPhotoUploadModalVisible(false);
        await uploadCompletionPhotos(result.assets);
      }
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("complaints.pickPhotosFailed"),
        text2: err.message,
      });
    }
  };

  // Worker: Take photo with camera
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: t("complaints.permissionRequired"),
          text2: t("complaints.cameraPermissionDenied"),
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets) {
        setSelectedPhotos(result.assets);
        setPhotoUploadModalVisible(false);
        await uploadCompletionPhotos(result.assets);
      }
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("complaints.takePhotoFailed"),
        text2: err.message,
      });
    }
  };

  // Worker: Upload completion photos (after photos)
  const uploadCompletionPhotos = async (photos) => {
    if (!photos || photos.length === 0) return;

    try {
      setUploadingPhotos(true);

      const formData = new FormData();
      photos.forEach((photo, index) => {
        const fileExtension = photo.uri.split(".").pop();
        formData.append("completionPhotos", {
          uri: photo.uri,
          type: `image/${fileExtension}`,
          name: `completion_${Date.now()}_${index}.${fileExtension}`,
        });
      });

      await apiCall({
        method: "POST",
        url: UPLOAD_COMPLETION_PHOTOS_URL(id),
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      Toast.show({
        type: "success",
        text1: t("complaints.uploadSuccess"),
        text2: t("complaints.afterPhotosUploaded"),
      });

      setSelectedPhotos([]);
      await load(true);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("complaints.uploadFailed"),
        text2: err?.response?.data?.message || t("complaints.couldNotUploadPhotos"),
      });
    } finally {
      setUploadingPhotos(false);
    }
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

    try {
      setVotingInProgress(true);

      const response = await apiCall({
        method: "POST",
        url: SATISFACTION_VOTE_URL(id),
        data: { voteType },
      });

      Toast.show({
        type: "success",
        text1: t("complaints.voteRecorded"),
        text2:
          voteType === "up"
            ? t("complaints.thanksForPositiveFeedback")
            : t("complaints.feedbackReceived"),
      });

      // Update satisfaction votes from response
      if (response?.data?.satisfactionVotes) {
        setSatisfactionVotes(response.data.satisfactionVotes);
      } else {
        // Fallback: refresh votes
        await fetchSatisfactionVotes();
      }
    } catch (err) {
      Toast.show({
        type: "error",
        text1: t("complaints.voteFailed"),
        text2: err?.response?.data?.message || t("complaints.couldNotRecordVote"),
      });
    } finally {
      setVotingInProgress(false);
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

  const statusOptions = [
    { value: "assigned", label: t("complaints.status.assigned") },
    { value: "in-progress", label: t("complaints.status.inProgress") },
    {
      value: "pending-approval",
      label: t("complaints.status.pendingApproval"),
    },
  ];

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

        {/* Discussion Thread - Moved up for quicker access */}
        {showDiscussionThread && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 pr-2">
                <View
                  className="w-9 h-9 rounded-xl items-center justify-center"
                  style={{ backgroundColor: colors.primary + "18" }}
                >
                  <MessageSquare size={16} color={colors.primary} />
                </View>
                <View className="ml-2.5 flex-1">
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("complaints.details.complaintChat")}
                  </Text>
                  <Text
                    className="text-xs mt-0.5"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("complaints.details.complaintChatSubtitle")}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/complaints/complaint-chat",
                    params: { id, ticketId: complaint.ticketId },
                  })
                }
                className="h-10 flex-row items-center justify-center px-3.5 rounded-xl"
                style={{
                  backgroundColor: colors.primary,
                  borderWidth: 1,
                  borderColor: `${colors.backgroundPrimary}CC`,
                }}
              >
                <MessageSquare size={14} color={colors.light} />
                <Text
                  className="text-sm font-semibold ml-1.5"
                  style={{ color: colors.light }}
                >
                  {t("complaints.details.openChat")}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

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
                  ? colors.error
                  : slaCountdown?.isCritical
                    ? colors.error
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
                      ? colors.error
                      : slaCountdown?.isCritical
                        ? colors.error
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
                  style={{ backgroundColor: colors.error + "22" }}
                >
                  <AlertTriangle size={14} color={colors.error} />
                  <Text
                    className="text-sm font-bold ml-1.5"
                    style={{ color: colors.error }}
                  >
                    {t("complaints.details.sla.overdue")}
                  </Text>
                </View>
              ) : slaCountdown ? (
                <View
                  className="flex-row items-center px-3 py-1 rounded-lg"
                  style={{
                    backgroundColor: slaCountdown.isCritical
                      ? colors.error + "22"
                      : slaCountdown.isUrgent
                        ? colors.warning + "22"
                        : colors.success + "22",
                  }}
                >
                  <Clock
                    size={14}
                    color={
                      slaCountdown.isCritical
                        ? colors.error
                        : slaCountdown.isUrgent
                          ? colors.warning
                          : colors.success
                    }
                  />
                  <Text
                    className="text-sm font-bold ml-1.5"
                    style={{
                      color: slaCountdown.isCritical
                        ? colors.error
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

        {/* ETA Card — next to SLA, for assigned/in-progress */}
        {complaint.estimatedCompletionTime &&
          (complaint.status === "assigned" ||
            complaint.status === "in-progress") && (
            <Card
              style={{
                margin: 0,
                marginBottom: 12,
                flex: 0,
                borderWidth: 1.5,
                borderColor: colors.info + "60",
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Clock size={18} color={colors.info} />
                  <Text
                    className="text-base font-semibold ml-2"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("complaints.details.estimatedCompletion")}
                  </Text>
                </View>
                <View
                  className="px-3 py-1 rounded-lg"
                  style={{ backgroundColor: colors.info + "18" }}
                >
                  <Text
                    className="text-sm font-bold"
                    style={{ color: colors.info }}
                  >
                    {complaint.estimatedCompletionTime < 24
                      ? `${complaint.estimatedCompletionTime}h`
                      : `${Math.round(complaint.estimatedCompletionTime / 24)}d`}
                  </Text>
                </View>
              </View>
            </Card>
          )}

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
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                  <TouchableOpacity
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      setUpvoteInfoModalVisible(true);
                    }}
                    className="w-8 h-8 rounded-full items-center justify-center ml-2"
                    style={{ backgroundColor: colors.backgroundSecondary }}
                  >
                    <Info size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          </PressableBlock>
        )}

        {/* HOD/Worker: Upvote Count (Read-only) */}
        {(userRole === "head" || userRole === "worker") && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
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
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.backgroundPrimary }}
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
        )}

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
                    {t("complaints.details.estimatedAffected")} {" "}
                    <Text
                      className="font-semibold"
                      style={{ color: colors.textPrimary }}
                    >
                      ~{complaint.aiAnalysis.affectedCount} {t("complaints.details.people")}
                    </Text>
                  </Text>
                </View>
              )}
            </Card>
          )}

        {/* HOD: Current Assigned Workers */}
        {userRole === "head" && complaint.isAssigned && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <View className="flex-row items-center mb-2">
              <Users size={18} color={colors.primary} />
              <Text
                className="text-sm ml-2 font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {complaint.assignedWorkers?.length === 1
                  ? t("complaints.details.currentlyAssigned")
                  : t("complaints.details.assignedWorkersCount", {
                      count: complaint.assignedWorkers?.length ?? 0,
                    })}
              </Text>
            </View>
            {(complaint.assignedWorkers ?? []).slice(0, 4).map((w, i) => (
              <View
                key={i}
                className="flex-row items-center justify-between mt-1"
              >
                <Text
                  className="text-sm font-semibold flex-1"
                  style={{ color: colors.textPrimary }}
                  numberOfLines={1}
                >
                  {w.workerName ?? t("complaints.details.assignedWorker")}
                </Text>
                <View
                  className="ml-2 px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor:
                      w.status === "completed"
                        ? colors.success + "22"
                        : w.status === "in-progress"
                          ? colors.warning + "22"
                          : w.status === "needs-rework"
                            ? colors.error + "22"
                            : colors.info + "22",
                  }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{
                      color:
                        w.status === "completed"
                          ? colors.success
                          : w.status === "in-progress"
                            ? colors.warning
                            : w.status === "needs-rework"
                              ? colors.error
                              : colors.info,
                    }}
                  >
                    {(w.status ?? "assigned").replace("-", " ")}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* HOD: Manage Workers Button */}
        {userRole === "head" &&
          complaint.status !== "resolved" &&
          complaint.status !== "cancelled" && (
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
                  marginBottom: 12,
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
                    {complaint.isAssigned
                      ? t("complaints.details.manageWorkers")
                      : t("complaints.details.assignToWorker")}
                  </Text>
                </View>
              </Card>
            </PressableBlock>
          )}

        {userRole === "head" &&
          complaint.status !== "resolved" &&
          complaint.status !== "cancelled" &&
          !complaint.isAssigned && (
            <PressableBlock
              onPress={handleCancelComplaint}
              disabled={cancelling}
            >
              <Card
                style={{
                  margin: 0,
                  marginBottom: 12,
                  flex: 0,
                  backgroundColor: colors.error,
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

        {/* HOD: Review Pending Approval */}
        {userRole === "head" && complaint.status === "pending-approval" && (
          <View className="mb-3">
            <Card
              style={{
                margin: 0,
                marginBottom: 8,
                flex: 0,
                backgroundColor: colors.success,
              }}
            >
              <PressableBlock
                onPress={handleApproveCompletion}
                disabled={approving}
              >
                <View className="flex-row items-center justify-center py-1">
                  {approving ? (
                    <ActivityIndicator size="small" color={colors.light} />
                  ) : (
                    <>
                      <Text
                        className="text-base font-semibold"
                        style={{ color: colors.light }}
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
                backgroundColor: colors.error,
              }}
            >
              <PressableBlock onPress={() => setApprovalModalVisible(true)}>
                <View className="flex-row items-center justify-center py-1">
                  <Text
                    className="text-base font-semibold"
                    style={{ color: colors.light }}
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
                  style={{ color: colors.light }}
                >
                  {t("complaints.details.updateStatus")}
                </Text>
              </Card>
            </PressableBlock>
          )}

        {/* Worker: Upload After Photos Button */}
        {userRole === "worker" &&
          complaint.status !== "resolved" &&
          complaint.status !== "cancelled" && (
            <PressableBlock onPress={() => setPhotoUploadModalVisible(true)}>
              <Card
                style={{
                  margin: 0,
                  marginBottom: 12,
                  flex: 0,
                  backgroundColor: colors.success,
                }}
              >
                <View className="flex-row items-center justify-center py-1">
                  <Upload size={20} color={colors.light} />
                  <Text
                    className="text-base font-semibold ml-2"
                    style={{ color: colors.light }}
                  >
                    {t("complaints.uploadAfterPhotos")}
                  </Text>
                </View>
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
                <Text
                  className="text-xs ml-1"
                  style={{ color: colors.muted }}
                >
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
                    <MaterialIcons name="place" size={14} color={colors.light} />
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

        {/* Satisfaction Voting - Only for resolved complaints */}
        {complaint.status === "resolved" && satisfactionVotes && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <View className="mb-3">
              <Text
                className="text-base font-semibold mb-2"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.satisfactionVote")}
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {t("complaints.satisfactionVoteDesc")}
              </Text>
            </View>

            <View className="flex-row items-center justify-around mb-4">
              <Pressable
                onPress={() => handleSatisfactionVote("up")}
                disabled={votingInProgress}
                className="flex-1 mr-2 py-4 rounded-xl items-center"
                style={{
                  backgroundColor:
                    satisfactionVotes.userVote === "up"
                      ? colors.success
                      : colors.backgroundSecondary,
                  opacity: votingInProgress ? 0.5 : 1,
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
                  {t("complaints.satisfied")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleSatisfactionVote("down")}
                disabled={votingInProgress}
                className="flex-1 ml-2 py-4 rounded-xl items-center"
                style={{
                  backgroundColor:
                    satisfactionVotes.userVote === "down"
                      ? colors.error
                      : colors.backgroundSecondary,
                  opacity: votingInProgress ? 0.5 : 1,
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
                  {t("complaints.notSatisfied")}
                </Text>
              </Pressable>
            </View>

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
                      style={{ color: colors.error }}
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
                  {t("complaints.yourVoteRecorded")}
                </Text>
              </View>
            )}
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
            />
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
                        {t("complaints.details.sla.level")}{" "}
                        {entry.level}{" "}
                        {t("complaints.details.sla.escalation")}
                      </Text>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: colors.textSecondary }}
                      >
                        {formatHistoryDate(entry.escalatedAt)}
                      </Text>
                      {entry.escalatedTo && (
                        <Text
                          className="text-xs mt-0.5"
                          style={{ color: colors.muted }}
                        >
                          → {entry.escalatedTo}
                        </Text>
                      )}
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
                <Star
                  size={18}
                  color={colors.warning}
                  fill={colors.warning}
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
          style={{ backgroundColor: colors.dark + "F2" }}
        >
          <View className="flex-1 justify-center items-center">
            <Pressable
              onPress={() => setImageModalVisible(false)}
              className="absolute top-12 right-4 z-10 w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <X size={22} color={colors.light} />
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

      {/* HOD: Assign Worker → navigate to dedicated page */}

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
                    <ActivityIndicator size="small" color={colors.light} />
                  ) : (
                    <Text
                      className="text-base font-semibold"
                      style={{ color: colors.light }}
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

      {/* Worker: Photo Upload Modal */}
      {userRole === "worker" && (
        <Modal
          visible={photoUploadModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPhotoUploadModalVisible(false)}
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
                {t("complaints.uploadAfterPhotos")}
              </Text>

              <Text
                className="text-sm mb-6 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.uploadAfterPhotosDesc")}
              </Text>

              <View className="mb-4">
                <Pressable
                  onPress={takePhoto}
                  disabled={uploadingPhotos}
                  className="flex-row items-center justify-center py-4 rounded-xl mb-3"
                  style={{
                    backgroundColor: colors.primary,
                    opacity: uploadingPhotos ? 0.5 : 1,
                  }}
                >
                  <Camera size={24} color={colors.light} />
                  <Text
                    className="text-base font-semibold ml-2"
                    style={{ color: colors.light }}
                  >
                    {t("complaints.takePhoto")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={pickPhotosFromGallery}
                  disabled={uploadingPhotos}
                  className="flex-row items-center justify-center py-4 rounded-xl"
                  style={{
                    backgroundColor: colors.success,
                    opacity: uploadingPhotos ? 0.5 : 1,
                  }}
                >
                  <ImageIcon size={24} color={colors.light} />
                  <Text
                    className="text-base font-semibold ml-2"
                    style={{ color: colors.light }}
                  >
                    {t("complaints.chooseFromGallery")}
                  </Text>
                </Pressable>
              </View>

              {uploadingPhotos && (
                <View className="items-center mb-4">
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text
                    className="text-sm mt-2"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("complaints.uploading")}
                  </Text>
                </View>
              )}

              <Pressable
                onPress={() => setPhotoUploadModalVisible(false)}
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
                    backgroundColor: colors.error,
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
