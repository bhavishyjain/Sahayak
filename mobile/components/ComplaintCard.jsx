import { CheckCircle, Clock, MapPin, ThumbsUp } from "lucide-react-native";
import { Text, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import {
  formatPriorityLabel,
  formatStatusLabel,
  getPriorityColor,
  getStatusColor,
} from "../data/complaintStatus";
import {
  formatDateShort,
  formatEtaFromHours,
  isComplaintAssigned,
} from "../utils/complaintHelpers";
import { useTheme } from "../utils/context/theme";
import { useTranslation } from "../utils/i18n/LanguageProvider";
import Card from "./Card";
import PressableBlock from "./PressableBlock";
import SlaStatusBadge from "./SlaStatusBadge";

export default function ComplaintCard({
  complaint,
  onOpen,
  showAssignmentStatus = false,
  showAssignedAt = false,
}) {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const isAssigned = isComplaintAssigned(complaint);
  const assignedAt =
    complaint?.assignedAt || complaint?.assignedWorkers?.[0]?.assignedAt;

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const eta = formatEtaFromHours(
    complaint?.estimatedCompletionTime,
    complaint?.assignedAt,
    t("complaints.overdue"),
  );
  const shouldHideSlaIndicators = [
    "resolved",
    "cancelled",
    "needs-rework",
  ].includes(String(complaint?.status || "").toLowerCase());

  return (
    <PressableBlock
      onPress={onOpen}
      style={{ flexGrow: 0, flexShrink: 0, flexBasis: "auto" }}
    >
      <Card
        style={{
          margin: 0,
          marginTop: 10,
          flex: 0,
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: "auto",
          alignSelf: "stretch",
        }}
      >
        <View className="flex-row items-center justify-between mb-1.5">
          <Text
            className="text-base font-bold"
            style={{ color: colors.primary }}
          >
            #{complaint?.ticketId || "-"}
          </Text>
          <Text className="text-xs" style={{ color: colors.textSecondary }}>
            {formatDateShort(complaint?.createdAt)}
          </Text>
        </View>

        <View
          className="flex-row justify-between items-center flex-wrap mb-2"
          style={{ gap: 6 }}
        >
          {complaint?.sla && !shouldHideSlaIndicators && (
            <SlaStatusBadge sla={complaint.sla} status={complaint?.status} />
          )}
          <View
            className="px-2 py-1 rounded"
            style={{
              backgroundColor: getStatusColor(complaint?.status, colors) + "20",
            }}
          >
            <Text
              className="text-xs font-semibold capitalize"
              style={{ color: getStatusColor(complaint?.status, colors) }}
            >
              {formatStatusLabel(t, complaint?.status)}
            </Text>
          </View>
        </View>

        <Text
          className="text-base font-semibold mb-1"
          numberOfLines={1}
          style={{ color: colors.textPrimary }}
        >
          {complaint?.title || t("complaints.complaint")}
        </Text>

        <Text
          className="text-xs mb-2"
          numberOfLines={2}
          style={{ color: colors.textSecondary }}
        >
          {complaint?.description || ""}
        </Text>

        <View className="flex-row items-center mb-2">
          <MapPin size={13} color={colors.textSecondary} />
          <Text
            className="text-xs ml-1 flex-1"
            numberOfLines={1}
            style={{ color: colors.textSecondary }}
          >
            {complaint?.locationName || t("complaints.locationNotSet")}
          </Text>
        </View>

        {showAssignmentStatus && (
          <View className="flex-row items-center justify-end mb-2">
            {isAssigned ? (
              <>
                <CheckCircle size={13} color={colors.success || "#10B981"} />
                <Text
                  className="text-xs ml-1 font-semibold"
                  style={{ color: colors.success || "#10B981" }}
                >
                  {t("status.assigned")}
                </Text>
              </>
            ) : null}
          </View>
        )}

        {showAssignedAt && assignedAt && (
          <View className="flex-row items-center mb-2">
            <Clock size={13} color={colors.textSecondary} />
            <Text
              className="text-xs ml-1"
              style={{ color: colors.textSecondary }}
            >
              {t("worker.assigned.assignedAt", {
                date: formatDateTime(assignedAt),
              })}
            </Text>
          </View>
        )}

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View
              className="px-2 py-0.5 rounded-md"
              style={{
                backgroundColor:
                  getPriorityColor(complaint?.priority, colors) + "22",
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: getPriorityColor(complaint?.priority, colors) }}
              >
                {formatPriorityLabel(t, complaint?.priority)}
              </Text>
            </View>
            {!shouldHideSlaIndicators &&
              complaint?.estimatedCompletionTime &&
              eta && (
                <View className="flex-row items-center">
                  <Clock
                    size={12}
                    color={
                      eta === t("complaints.overdue")
                        ? "#EF4444"
                        : colors.info || "#3B82F6"
                    }
                  />
                  <Text
                    className="text-xs ml-1 font-semibold"
                    style={{
                      color:
                        eta === t("complaints.overdue")
                          ? "#EF4444"
                          : colors.info || "#3B82F6",
                    }}
                  >
                    {eta}
                  </Text>
                </View>
              )}
          </View>

          <View
            className="flex-row items-center px-2 py-1 rounded-md"
            style={{
              backgroundColor: colors.backgroundSecondary,
            }}
          >
            <ThumbsUp
              size={12}
              color={
                complaint?.hasUpvoted ? colors.primary : colors.textSecondary
              }
              fill={complaint?.hasUpvoted ? colors.primary : "transparent"}
            />
            <Text
              className="text-xs ml-1 font-semibold"
              style={{
                color: complaint?.hasUpvoted
                  ? colors.primary
                  : colors.textSecondary,
              }}
            >
              {complaint?.upvoteCount || 0}
            </Text>
          </View>
        </View>
      </Card>
    </PressableBlock>
  );
}
