import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import {
  Calendar,
  MapPin,
  Search,
  ThumbsUp,
  Trash2,
} from "lucide-react-native";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import PressableBlock from "../../../components/PressableBlock";
import SearchBar from "../../../components/SearchBar";
import {
  formatStatusLabel,
  getPriorityColor,
  getStatusColor,
} from "../../../data/complaintStatus";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import useDepartments from "../../../utils/hooks/useDepartments";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import {
  ADMIN_COMPLAINT_DETAIL_URL,
  GET_MY_COMPLAINTS_URL,
} from "../../../url";

function DetailRow({ label, value, colors, compact = false }) {
  return (
    <View className={compact ? "" : "mb-3"}>
      <Text className="text-xs" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      <Text className="text-sm mt-1" style={{ color: colors.textPrimary }}>
        {value || "-"}
      </Text>
    </View>
  );
}

function InlineMeta({ icon: Icon, label, value, colors }) {
  return (
    <View className="flex-row items-center">
      <Icon size={14} color={colors.textSecondary} />
      <Text className="text-xs ml-2" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      <Text className="text-sm font-semibold ml-2" style={{ color: colors.textPrimary }}>
        {value || "-"}
      </Text>
    </View>
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminEditComplaintScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const { departmentOptions } = useDepartments();

  const [ticketId, setTicketId] = useState("");
  const [complaint, setComplaint] = useState(null);
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const priorityOptions = useMemo(() => ["Low", "Medium", "High"], []);
  const statusColor = complaint
    ? getStatusColor(complaint.status, colors) ?? colors.warning
    : colors.warning;
  const priorityColor = complaint
    ? getPriorityColor(complaint.priority || priority, colors) ?? colors.primary
    : colors.primary;
  const upvoteCount = Array.isArray(complaint?.upvotes)
    ? complaint.upvotes.length
    : Number(complaint?.upvoteCount ?? complaint?.upvotesCount ?? 0);

  const handleSearch = async () => {
    const nextTicketId = ticketId.trim();
    if (!nextTicketId) {
      Toast.show({
        type: "error",
        text1: t("adminScreens.editComplaint.toasts.complaintIdRequiredTitle"),
        text2: t("adminScreens.editComplaint.toasts.complaintIdRequiredMessage"),
      });
      return;
    }

    try {
      setSearching(true);
      const response = await apiCall({
        method: "GET",
        url: GET_MY_COMPLAINTS_URL,
        params: {
          scope: "all",
          ticketId: nextTicketId,
          limit: 1,
          page: 1,
        },
      });

      const item = response?.data?.complaints?.[0];
      if (!item) {
        setComplaint(null);
        setDepartment("");
        setPriority("");
        Toast.show({
          type: "error",
          text1: t("adminScreens.editComplaint.toasts.notFoundTitle"),
          text2: t("adminScreens.editComplaint.toasts.notFoundMessage"),
        });
        return;
      }

      setComplaint(item);
      setDepartment(item.department || "");
      setPriority(item.priority || "");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("adminScreens.editComplaint.toasts.searchFailedTitle"),
        text2:
          error?.response?.data?.message ||
          t("adminScreens.editComplaint.toasts.searchFailedMessage"),
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!complaint?._id && !complaint?.id) return;
    if (!department || !priority) {
      Toast.show({
        type: "error",
        text1: t("adminScreens.editComplaint.toasts.missingDetailsTitle"),
        text2: t("adminScreens.editComplaint.toasts.missingDetailsMessage"),
      });
      return;
    }

    try {
      setSaving(true);
      await apiCall({
        method: "PUT",
        url: ADMIN_COMPLAINT_DETAIL_URL(complaint._id || complaint.id),
        data: {
          department,
          priority,
        },
      });
      setComplaint((previous) =>
        previous
          ? {
              ...previous,
              department,
              priority,
            }
          : previous,
      );
      Toast.show({
        type: "success",
        text1: t("adminScreens.editComplaint.toasts.updatedTitle"),
        text2: t("adminScreens.editComplaint.toasts.updatedMessage"),
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("adminScreens.editComplaint.toasts.updateFailedTitle"),
        text2:
          error?.response?.data?.message ||
          t("adminScreens.editComplaint.toasts.updateFailedMessage"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!complaint?._id && !complaint?.id) return;

    try {
      setDeleting(true);
      await apiCall({
        method: "DELETE",
        url: ADMIN_COMPLAINT_DETAIL_URL(complaint._id || complaint.id),
      });
      Toast.show({
        type: "success",
        text1: t("adminScreens.editComplaint.toasts.deletedTitle"),
        text2: t("adminScreens.editComplaint.toasts.deletedMessage"),
      });
      setComplaint(null);
      setTicketId("");
      setDepartment("");
      setPriority("");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("adminScreens.editComplaint.toasts.deleteFailedTitle"),
        text2:
          error?.response?.data?.message ||
          t("adminScreens.editComplaint.toasts.deleteFailedMessage"),
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("adminScreens.editComplaint.title")} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="rounded-2xl p-4 mb-4"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            className="text-base font-semibold mb-1"
            style={{ color: colors.textPrimary }}
          >
            {t("adminScreens.editComplaint.searchTitle")}
          </Text>
          <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
            {t("adminScreens.editComplaint.searchSubtitle")}
          </Text>

          <SearchBar
            value={ticketId}
            onChangeText={setTicketId}
            placeholder={t("adminScreens.editComplaint.searchPlaceholder")}
          />

          <PressableBlock
            onPress={handleSearch}
            disabled={searching}
            className="rounded-2xl py-4 items-center mt-4"
            style={{
              backgroundColor: searching ? colors.border : colors.primary,
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.dark }}
            >
              {searching
                ? t("adminScreens.editComplaint.searching")
                : t("adminScreens.editComplaint.searchButton")}
            </Text>
          </PressableBlock>
        </View>

        {complaint ? (
          <View
            className="rounded-2xl p-4"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              className="text-base font-semibold"
              style={{ color: colors.textPrimary }}
            >
              {t("adminScreens.editComplaint.reviewTitle")}
            </Text>
            <Text
              className="text-xs mt-1 mb-4"
              style={{ color: colors.textSecondary }}
            >
              {t("adminScreens.editComplaint.reviewSubtitle")}
            </Text>

            <Text
              className="text-xs font-semibold uppercase"
              style={{ color: colors.textSecondary }}
            >
              {complaint.ticketId}
            </Text>
            <Text
              className="text-xl font-semibold mt-2"
              style={{ color: colors.textPrimary }}
            >
              {complaint.title || t("adminScreens.editComplaint.untitled")}
            </Text>

            <Text
              className="text-sm leading-6 mb-4"
              style={{ color: colors.textSecondary }}
            >
              {complaint.description || t("adminScreens.editComplaint.noDescription")}
            </Text>

            <View
              className="rounded-xl px-4 py-3 mb-4"
              style={{
                backgroundColor: colors.backgroundPrimary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <InlineMeta
                icon={MapPin}
                label={t("adminScreens.editComplaint.labels.location")}
                value={complaint.locationName}
                colors={colors}
              />
              <View
                className="my-3 h-px"
                style={{ backgroundColor: colors.border }}
              />
              <InlineMeta
                icon={Search}
                label={t("adminScreens.editComplaint.labels.status")}
                value={formatStatusLabel(undefined, complaint.status)}
                colors={{
                  ...colors,
                  textPrimary: statusColor,
                }}
              />
              <View
                className="my-3 h-px"
                style={{ backgroundColor: colors.border }}
              />
              <InlineMeta
                icon={Search}
                label={t("adminScreens.editComplaint.labels.priority")}
                value={complaint.priority || priority || "-"}
                colors={{
                  ...colors,
                  textPrimary: priorityColor,
                }}
              />
              <View
                className="my-3 h-px"
                style={{ backgroundColor: colors.border }}
              />
              <InlineMeta
                icon={Calendar}
                label={t("adminScreens.editComplaint.labels.created")}
                value={formatDateTime(complaint.createdAt)}
                colors={colors}
              />
              <View
                className="my-3 h-px"
                style={{ backgroundColor: colors.border }}
              />
              <InlineMeta
                icon={ThumbsUp}
                label={t("adminScreens.editComplaint.labels.upvotes")}
                value={String(upvoteCount)}
                colors={colors}
              />
            </View>

            <View
              className="rounded-xl px-4 py-3 mb-4"
              style={{
                backgroundColor: colors.backgroundPrimary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                className="text-xs font-semibold uppercase mb-2"
                style={{ color: colors.textSecondary }}
              >
                {t("adminScreens.editComplaint.labels.currentRouting")}
              </Text>
              <View className="flex-row" style={{ gap: 12 }}>
                <View className="flex-1">
                  <DetailRow
                    label={t("adminScreens.editComplaint.labels.department")}
                    value={complaint.department}
                    colors={colors}
                    compact
                  />
                </View>
                <View className="flex-1">
                  <DetailRow
                    label={t("adminScreens.editComplaint.labels.priority")}
                    value={complaint.priority}
                    colors={colors}
                    compact
                  />
                </View>
              </View>
              <View
                className="my-3 h-px"
                style={{ backgroundColor: colors.border }}
              />
              <DetailRow
                label={t("adminScreens.editComplaint.labels.lastUpdated")}
                value={formatDateTime(complaint.updatedAt)}
                colors={colors}
                compact
              />
            </View>

            <Text
              className="text-xs font-semibold uppercase mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("adminScreens.editComplaint.departmentSection")}
            </Text>
            <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
              {departmentOptions.map((item) => (
                <PressableBlock
                  key={item.value}
                  onPress={() => setDepartment(item.value)}
                  className="px-3 py-2 rounded-lg"
                  style={{
                    backgroundColor:
                      department === item.value
                        ? colors.primary + "18"
                        : colors.backgroundPrimary,
                    borderWidth: 1,
                    borderColor:
                      department === item.value
                        ? colors.primary
                        : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{
                      color:
                        department === item.value
                          ? colors.primary
                          : colors.textPrimary,
                    }}
                  >
                    {item.label}
                  </Text>
                </PressableBlock>
              ))}
            </View>

            <Text
              className="text-xs font-semibold uppercase mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("adminScreens.editComplaint.prioritySection")}
            </Text>
            <View className="flex-row mb-5" style={{ gap: 8 }}>
              {priorityOptions.map((item) => (
                <PressableBlock
                  key={item}
                  onPress={() => setPriority(item)}
                  className="px-4 py-2 rounded-lg"
                  style={{
                    backgroundColor:
                      priority === item
                        ? colors.primary + "18"
                        : colors.backgroundPrimary,
                    borderWidth: 1,
                    borderColor:
                      priority === item ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{
                      color:
                        priority === item ? colors.primary : colors.textPrimary,
                    }}
                  >
                    {item}
                  </Text>
                </PressableBlock>
              ))}
            </View>

            <PressableBlock
              onPress={handleSave}
              disabled={saving}
              className="rounded-2xl py-4 items-center mb-3"
              style={{
                backgroundColor: saving ? colors.border : colors.primary,
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.dark }}
              >
                {saving
                  ? t("adminScreens.editComplaint.saving")
                  : t("adminScreens.editComplaint.saveChanges")}
              </Text>
            </PressableBlock>

            <PressableBlock
              onPress={handleDelete}
              disabled={deleting}
              className="rounded-2xl py-4 items-center"
              style={{
                backgroundColor: colors.danger,
                opacity: deleting ? 0.7 : 1,
              }}
            >
              <View className="flex-row items-center">
                <Trash2 size={16} color={colors.light} />
                <Text
                  className="text-sm font-semibold ml-2"
                  style={{ color: colors.light }}
                >
                  {deleting
                    ? t("adminScreens.editComplaint.deleting")
                    : t("adminScreens.editComplaint.deleteComplaint")}
                </Text>
              </View>
            </PressableBlock>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
