import {
  FileText,
  Download,
  FileSpreadsheet,
  FileBarChart,
  Filter,
  BarChart3,
  RotateCcw,
  TrendingUp,
  Calendar,
  Clock,
  Mail,
  Send,
  AlertCircle,
  CheckCircle,
  Trash2,
  X,
  ChevronRight,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import Card from "../../../components/Card";
import BackButtonHeader from "../../../components/BackButtonHeader";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import { formatStatusLabel } from "../../../utils/complaintFormatters";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useDownloadReport, useReportStats } from "../../../utils/hooks/useReports";
import getUserAuth from "../../../utils/userAuth";
import apiCall from "../../../utils/api";
import {
  REPORT_SCHEDULE_URL,
  REPORT_SCHEDULES_URL,
  REPORT_CANCEL_SCHEDULE_URL,
  REPORT_EMAIL_URL,
} from "../../../url";

const STATUS_OPTIONS = [
  "pending",
  "assigned",
  "in-progress",
  "pending-approval",
  "needs-rework",
  "resolved",
  "cancelled",
];

function normalizeFilters(filters) {
  const normalized = {};
  if (filters.department && filters.department !== "all") {
    normalized.department = filters.department;
  }
  if (filters.status && filters.status !== "all") {
    normalized.status = filters.status;
  }
  if (filters.startDate) normalized.startDate = filters.startDate;
  if (filters.endDate) normalized.endDate = filters.endDate;
  return normalized;
}

export default function HODReports() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  // Tab state
  const [activeTab, setActiveTab] = useState("export"); // "export" or "schedule"

  // HOD's own department (loaded from auth)
  const [hodDepartment, setHodDepartment] = useState("");

  useEffect(() => {
    getUserAuth().then((user) => {
      const dept = user?.department || "";
      setHodDepartment(dept);
      setAppliedFilters((prev) => ({ ...prev, department: dept }));
      setDraftFilters((prev) => ({ ...prev, department: dept }));
    });
  }, []);

  // Filter states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState({
    department: "",
    status: "all",
    startDate: "",
    endDate: "",
  });
  const [draftFilters, setDraftFilters] = useState(appliedFilters);

  // Schedule states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  const [scheduleFormat, setScheduleFormat] = useState("pdf");
  const [scheduling, setScheduling] = useState(false);
  const [activeSchedules, setActiveSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // Email report states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailFormat, setEmailFormat] = useState("pdf");
  const [sendingEmail, setSendingEmail] = useState(false);

  const normalizedFilters = useMemo(
    () => normalizeFilters(appliedFilters),
    [appliedFilters],
  );

  const { download } = useDownloadReport();
  const { data: statsRaw, isLoading: statsLoading } = useReportStats(normalizedFilters);

  const loadSchedules = async () => {
    try {
      setLoadingSchedules(true);
      const res = await apiCall({ method: "GET", url: REPORT_SCHEDULES_URL });
      setActiveSchedules(res?.data?.schedules || []);
    } catch {
      // silently ignore
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    if (activeTab === "schedule") loadSchedules();
  }, [activeTab]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      appliedFilters.status !== "all" ||
      appliedFilters.startDate ||
      appliedFilters.endDate,
    );
  }, [appliedFilters]);

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setShowFilterModal(false);
  };

  const resetDraftFilters = () => {
    setDraftFilters({
      department: hodDepartment,
      status: "all",
      startDate: "",
      endDate: "",
    });
  };

  const syncAndCloseFilters = () => {
    setDraftFilters(appliedFilters);
    setShowFilterModal(false);
  };

  const downloadReport = async (format) => {
    try {
      setDownloadingFormat(format);
      await download({ format, filters: normalizedFilters });
      Toast.show({
        type: "success",
        text1: t("reports.reportGenerated"),
        text2: `${format.toUpperCase()} report is ready`,
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: error?.response?.data?.message || t("reports.generateFailed"),
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleScheduleReport = async () => {
    if (!scheduleEmail || !scheduleEmail.includes("@")) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: "Please enter a valid email address",
      });
      return;
    }

    try {
      setScheduling(true);
      await apiCall({
        method: "POST",
        url: REPORT_SCHEDULE_URL,
        data: {
          email: scheduleEmail,
          frequency: scheduleFrequency,
          format: scheduleFormat,
          department:
            appliedFilters.department !== "all"
              ? appliedFilters.department
              : undefined,
          status:
            appliedFilters.status !== "all" ? appliedFilters.status : undefined,
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
        },
      });

      Toast.show({
        type: "success",
        text1: "Report Scheduled",
        text2: `You'll receive ${scheduleFrequency} reports at ${scheduleEmail}`,
      });

      setShowScheduleModal(false);
      setScheduleEmail("");
      setScheduleFrequency("weekly");
      setScheduleFormat("pdf");
      loadSchedules();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: error?.response?.data?.message || "Failed to schedule report",
      });
    } finally {
      setScheduling(false);
    }
  };

  const handleCancelSchedule = async (scheduleId) => {
    try {
      setCancellingId(scheduleId);
      await apiCall({
        method: "DELETE",
        url: REPORT_CANCEL_SCHEDULE_URL(scheduleId),
      });
      Toast.show({ type: "success", text1: "Schedule Cancelled" });
      loadSchedules();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: error?.response?.data?.message || "Failed to cancel schedule",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress || !emailAddress.includes("@")) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: "Please enter a valid email address",
      });
      return;
    }

    try {
      setSendingEmail(true);
      await apiCall({
        method: "POST",
        url: REPORT_EMAIL_URL,
        data: {
          email: emailAddress,
          format: emailFormat,
          department:
            appliedFilters.department !== "all"
              ? appliedFilters.department
              : undefined,
          status:
            appliedFilters.status !== "all" ? appliedFilters.status : undefined,
          startDate: appliedFilters.startDate || undefined,
          endDate: appliedFilters.endDate || undefined,
        },
      });

      Toast.show({
        type: "success",
        text1: "Report Sent",
        text2: `Report has been sent to ${emailAddress}`,
      });

      setShowEmailModal(false);
      setEmailAddress("");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: error?.response?.data?.message || "Failed to send report",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("reports.title")} colors={colors} />

      {/* Stats Section */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="px-4 pt-4">
          {/* Stats Cards */}
          {statsLoading && (
            <View
              className="rounded-2xl p-4 items-center justify-center mb-4"
              style={{ backgroundColor: colors.backgroundSecondary, height: 96 }}
            >
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
          {!statsLoading && statsRaw && (() => {
            const total = statsRaw.total || 0;
            const byStatus = statsRaw.byStatus || {};
            const byPriority = statsRaw.byPriority || {};
            const avgHours = statsRaw.avgResolutionTime || 0;
            const activeCount = [
              "pending",
              "assigned",
              "in-progress",
              "pending-approval",
              "needs-rework",
            ].reduce((sum, s) => sum + (byStatus[s] || 0), 0);
            const resolvedCount = byStatus["resolved"] || 0;
            const avgLabel =
              avgHours === 0
                ? "N/A"
                : avgHours < 24
                ? `${avgHours}h`
                : `${Math.floor(avgHours / 24)}d ${avgHours % 24}h`;

            const Tile = ({ label, value, color, bg }) => (
              <View
                className="flex-1 rounded-xl p-3 items-center"
                style={{ backgroundColor: bg }}
              >
                <Text
                  className="text-xl font-bold"
                  style={{ color }}
                >
                  {value}
                </Text>
                <Text
                  className="text-xs mt-0.5"
                  style={{ color }}
                >
                  {label}
                </Text>
              </View>
            );

            return (
              <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{ backgroundColor: colors.primary + "20" }}
                  >
                    <BarChart3 size={20} color={colors.primary} />
                  </View>
                  <Text
                    className="text-base font-bold ml-3 flex-1"
                    style={{ color: colors.textPrimary }}
                  >
                    Complaint Statistics
                  </Text>
                  {hasActiveFilters && (
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: colors.primary + "20" }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: colors.primary }}
                      >
                        Filtered
                      </Text>
                    </View>
                  )}
                </View>

                {/* Totals row */}
                <View className="flex-row mb-3" style={{ gap: 8 }}>
                  <Tile
                    label="Total"
                    value={total}
                    color={colors.primary}
                    bg={colors.primary + "18"}
                  />
                  <Tile
                    label="Active"
                    value={activeCount}
                    color={colors.warning || "#F59E0B"}
                    bg={(colors.warning || "#F59E0B") + "18"}
                  />
                  <Tile
                    label="Resolved"
                    value={resolvedCount}
                    color={colors.success || "#10B981"}
                    bg={(colors.success || "#10B981") + "18"}
                  />
                </View>

                {/* Priority row */}
                <View className="flex-row mb-3" style={{ gap: 8 }}>
                  <Tile
                    label="High"
                    value={byPriority["High"] || 0}
                    color="#EF4444"
                    bg="#EF444418"
                  />
                  <Tile
                    label="Medium"
                    value={byPriority["Medium"] || 0}
                    color="#F59E0B"
                    bg="#F59E0B18"
                  />
                  <Tile
                    label="Low"
                    value={byPriority["Low"] || 0}
                    color="#10B981"
                    bg="#10B98118"
                  />
                </View>

                {/* Avg resolution time */}
                <View
                  className="flex-row items-center rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <TrendingUp size={15} color={colors.textSecondary} />
                  <Text
                    className="text-sm ml-2 flex-1"
                    style={{ color: colors.textSecondary }}
                  >
                    Avg resolution time
                  </Text>
                  <Text
                    className="text-sm font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {avgLabel}
                  </Text>
                </View>
              </Card>
            );
          })()}

          {/* Tab Navigator */}
          <View
            className="flex-row rounded-2xl p-1 mb-4"
            style={{ backgroundColor: colors.backgroundSecondary }}
          >
            <TouchableOpacity
              onPress={() => setActiveTab("export")}
              className="flex-1 py-3 rounded-xl items-center"
              style={{
                backgroundColor:
                  activeTab === "export" ? colors.primary : "transparent",
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color:
                    activeTab === "export" ? "#FFFFFF" : colors.textSecondary,
                }}
              >
                Export & Download
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("schedule")}
              className="flex-1 py-3 rounded-xl items-center"
              style={{
                backgroundColor:
                  activeTab === "schedule" ? colors.primary : "transparent",
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color:
                    activeTab === "schedule" ? "#FFFFFF" : colors.textSecondary,
                }}
              >
                Schedule Reports
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter Badge */}
          <TouchableOpacity
            onPress={() => setShowFilterModal(true)}
            className="rounded-2xl p-4 flex-row items-center justify-between mb-4"
            style={{
              backgroundColor: hasActiveFilters
                ? colors.primary + "20"
                : colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: hasActiveFilters ? colors.primary : colors.border,
            }}
          >
            <View className="flex-row items-center flex-1">
              <Filter
                size={20}
                color={hasActiveFilters ? colors.primary : colors.textSecondary}
              />
              <View className="ml-3 flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color: hasActiveFilters
                      ? colors.primary
                      : colors.textPrimary,
                  }}
                >
                  {hasActiveFilters ? "Filters Applied" : "Add Filters"}
                </Text>
                {hasActiveFilters && (
                  <Text
                    className="text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    {[
                      appliedFilters.status !== "all" && appliedFilters.status,
                      appliedFilters.startDate &&
                        `From: ${appliedFilters.startDate}`,
                      appliedFilters.endDate && `To: ${appliedFilters.endDate}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
              </View>
            </View>
            <ChevronRight
              size={18}
              color={hasActiveFilters ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Export Tab Content */}
          {activeTab === "export" && (
            <>
              <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-12 h-12 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: colors.primary + "20" }}
                  >
                    <Download size={24} color={colors.primary} />
                  </View>
                  <View className="ml-3">
                    <Text
                      className="text-lg font-bold"
                      style={{ color: colors.textPrimary }}
                    >
                      Download Reports
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      Export in your preferred format
                    </Text>
                  </View>
                </View>

                <View
                  className="h-[1px] mb-4"
                  style={{ backgroundColor: colors.border }}
                />

                {/* Export Options */}
                <View className="space-y-3">
                  {/* PDF */}
                  <TouchableOpacity
                    onPress={() => downloadReport("pdf")}
                    disabled={Boolean(downloadingFormat)}
                    activeOpacity={0.7}
                    className="rounded-xl p-4 flex-row items-center"
                    style={{
                      backgroundColor: colors.backgroundSecondary,
                      borderWidth: 2,
                      borderColor:
                        downloadingFormat === "pdf"
                          ? colors.primary
                          : "transparent",
                    }}
                  >
                    <View
                      className="w-12 h-12 rounded-xl items-center justify-center"
                      style={{ backgroundColor: "#EF444420" }}
                    >
                      <FileText size={24} color="#EF4444" />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text
                        className="text-base font-bold mb-1"
                        style={{ color: colors.textPrimary }}
                      >
                        PDF Report
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        Professional document format
                      </Text>
                    </View>
                    {downloadingFormat === "pdf" ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Download size={20} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {/* Excel */}
                  <TouchableOpacity
                    onPress={() => downloadReport("excel")}
                    disabled={Boolean(downloadingFormat)}
                    activeOpacity={0.7}
                    className="rounded-xl p-4 flex-row items-center"
                    style={{
                      backgroundColor: colors.backgroundSecondary,
                      borderWidth: 2,
                      borderColor:
                        downloadingFormat === "excel"
                          ? colors.primary
                          : "transparent",
                    }}
                  >
                    <View
                      className="w-12 h-12 rounded-xl items-center justify-center"
                      style={{ backgroundColor: colors.success + "20" }}
                    >
                      <FileSpreadsheet
                        size={24}
                        color={colors.success || "#10B981"}
                      />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text
                        className="text-base font-bold mb-1"
                        style={{ color: colors.textPrimary }}
                      >
                        Excel Spreadsheet
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        Detailed data with charts
                      </Text>
                    </View>
                    {downloadingFormat === "excel" ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Download size={20} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>

                  {/* CSV */}
                  <TouchableOpacity
                    onPress={() => downloadReport("csv")}
                    disabled={Boolean(downloadingFormat)}
                    activeOpacity={0.7}
                    className="rounded-xl p-4 flex-row items-center"
                    style={{
                      backgroundColor: colors.backgroundSecondary,
                      borderWidth: 2,
                      borderColor:
                        downloadingFormat === "csv"
                          ? colors.primary
                          : "transparent",
                    }}
                  >
                    <View
                      className="w-12 h-12 rounded-xl items-center justify-center"
                      style={{ backgroundColor: colors.info + "20" }}
                    >
                      <FileBarChart
                        size={24}
                        color={colors.info || "#3B82F6"}
                      />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text
                        className="text-base font-bold mb-1"
                        style={{ color: colors.textPrimary }}
                      >
                        CSV Data
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        Raw data for analysis
                      </Text>
                    </View>
                    {downloadingFormat === "csv" ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Download size={20} color={colors.textSecondary} />
                    )}
                  </TouchableOpacity>
                </View>
              </Card>

              {/* Email Report Section */}
              <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-12 h-12 rounded-2xl items-center justify-center"
                    style={{
                      backgroundColor: colors.purple + "20" || "#8B5CF620",
                    }}
                  >
                    <Mail size={24} color={colors.purple || "#8B5CF6"} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text
                      className="text-lg font-bold"
                      style={{ color: colors.textPrimary }}
                    >
                      Email Report
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      Send report to any email
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setShowEmailModal(true)}
                  className="rounded-xl p-4 flex-row items-center justify-between"
                  style={{
                    backgroundColor: colors.purple + "15" || "#8B5CF615",
                    borderWidth: 1,
                    borderColor: colors.purple + "40" || "#8B5CF640",
                  }}
                >
                  <View className="flex-row items-center">
                    <Send size={20} color={colors.purple || "#8B5CF6"} />
                    <Text
                      className="text-sm font-semibold ml-2"
                      style={{ color: colors.purple || "#8B5CF6" }}
                    >
                      Send via Email
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.purple || "#8B5CF6"} />
                </TouchableOpacity>
              </Card>
            </>
          )}

          {/* Schedule Tab Content */}
          {activeTab === "schedule" && (
            <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
              <View className="flex-row items-center mb-4">
                <View
                  className="w-12 h-12 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: colors.success + "20" }}
                >
                  <Calendar size={24} color={colors.success || "#10B981"} />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-lg font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    Automated Reports
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    Get reports delivered to your inbox
                  </Text>
                </View>
                {loadingSchedules && (
                  <ActivityIndicator size="small" color={colors.primary} />
                )}
              </View>

              <View
                className="h-[1px] mb-4"
                style={{ backgroundColor: colors.border }}
              />

              {/* Schedule Options */}
              <View className="space-y-3">
                {[
                  {
                    freq: "daily",
                    label: "Daily Reports",
                    desc: "Receive reports every day at 9:00 AM",
                    icon: <Clock size={20} color={colors.primary} />,
                    activeColor: colors.primary,
                    activeBg: colors.primary + "20",
                  },
                  {
                    freq: "weekly",
                    label: "Weekly Reports",
                    desc: "Receive reports every Monday at 9:00 AM",
                    icon: (
                      <Calendar size={20} color={colors.info || "#3B82F6"} />
                    ),
                    activeColor: colors.info || "#3B82F6",
                    activeBg: (colors.info || "#3B82F6") + "20",
                  },
                  {
                    freq: "monthly",
                    label: "Monthly Reports",
                    desc: "Receive reports on the 1st of every month",
                    icon: (
                      <BarChart3
                        size={20}
                        color={colors.success || "#10B981"}
                      />
                    ),
                    activeColor: colors.success || "#10B981",
                    activeBg: (colors.success || "#10B981") + "20",
                  },
                ].map(({ freq, label, desc, icon, activeColor, activeBg }) => {
                  const existing = activeSchedules.find(
                    (s) => s.frequency === freq && s.isActive,
                  );
                  return (
                    <View
                      key={freq}
                      className="rounded-xl p-4"
                      style={{
                        backgroundColor: existing
                          ? activeBg
                          : colors.backgroundSecondary,
                        borderWidth: existing ? 1.5 : 0,
                        borderColor: existing ? activeColor : "transparent",
                      }}
                    >
                      <View className="flex-row items-center mb-2">
                        {existing ? (
                          <CheckCircle size={20} color={activeColor} />
                        ) : (
                          icon
                        )}
                        <Text
                          className="text-base font-bold ml-2 flex-1"
                          style={{
                            color: existing ? activeColor : colors.textPrimary,
                          }}
                        >
                          {label}
                        </Text>
                      </View>

                      {existing ? (
                        <>
                          <Text
                            className="text-xs mb-1"
                            style={{ color: colors.textSecondary }}
                          >
                            Sending to{" "}
                            <Text
                              className="font-semibold"
                              style={{ color: colors.textPrimary }}
                            >
                              {existing.email}
                            </Text>
                            {" · "}
                            <Text className="uppercase">{existing.format}</Text>
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleCancelSchedule(existing._id)}
                            disabled={cancellingId === existing._id}
                            className="rounded-lg py-2.5 flex-row items-center justify-center mt-2"
                            style={{
                              backgroundColor: "#EF444415",
                              borderWidth: 1,
                              borderColor: "#EF4444",
                            }}
                          >
                            {cancellingId === existing._id ? (
                              <ActivityIndicator size="small" color="#EF4444" />
                            ) : (
                              <>
                                <Trash2 size={14} color="#EF4444" />
                                <Text
                                  className="text-sm font-semibold ml-1.5"
                                  style={{ color: "#EF4444" }}
                                >
                                  Cancel Schedule
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <Text
                            className="text-xs mb-3"
                            style={{ color: colors.textSecondary }}
                          >
                            {desc}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              setScheduleFrequency(freq);
                              setShowScheduleModal(true);
                            }}
                            className="rounded-lg py-2.5 items-center"
                            style={{
                              backgroundColor: activeBg,
                              borderWidth: 1,
                              borderColor: activeColor,
                            }}
                          >
                            <Text
                              className="text-sm font-semibold"
                              style={{ color: activeColor }}
                            >
                              Set Up {label.split(" ")[0]} Report
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>

              <View
                className="rounded-xl p-4 mt-4"
                style={{
                  backgroundColor: colors.info + "10",
                  borderLeftWidth: 4,
                  borderLeftColor: colors.info || "#3B82F6",
                }}
              >
                <View className="flex-row items-start">
                  <AlertCircle
                    size={18}
                    color={colors.info || "#3B82F6"}
                    className="mt-0.5"
                  />
                  <View className="ml-2 flex-1">
                    <Text
                      className="text-xs font-semibold mb-1"
                      style={{ color: colors.info || "#3B82F6" }}
                    >
                      About Scheduled Reports
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      Reports will be generated automatically and sent to your
                      email. You can manage or cancel schedules anytime.
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={syncAndCloseFilters}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={syncAndCloseFilters}
        >
          <Pressable
            className="rounded-t-3xl p-6"
            style={{ backgroundColor: colors.backgroundPrimary }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                {t("reports.filters")}
              </Text>
              <TouchableOpacity onPress={syncAndCloseFilters}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("reports.filterStatus")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              <View className="flex-row">
                {["all", ...STATUS_OPTIONS].map((status) => {
                  const selected = draftFilters.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      onPress={() =>
                        setDraftFilters((prev) => ({ ...prev, status }))
                      }
                      className="px-3 py-2 rounded-xl mr-2"
                      style={{
                        backgroundColor: selected
                          ? colors.primary + "20"
                          : colors.backgroundSecondary,
                        borderWidth: 1,
                        borderColor: selected ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        className="text-xs font-semibold capitalize"
                        style={{
                          color: selected ? colors.primary : colors.textPrimary,
                        }}
                      >
                        {status === "all"
                          ? t("common.all")
                          : formatStatusLabel(t, status)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("reports.filterDateRange")}
            </Text>
            <View className="flex-row mb-5" style={{ gap: 8 }}>
              <View className="flex-1">
                <DateTimePickerModal
                  mode="date"
                  value={draftFilters.startDate}
                  onChange={(value) =>
                    setDraftFilters((prev) => ({ ...prev, startDate: value }))
                  }
                  placeholder={t("reports.filterStartDate")}
                  maxDateToday
                />
              </View>
              <View className="flex-1">
                <DateTimePickerModal
                  mode="date"
                  value={draftFilters.endDate}
                  onChange={(value) =>
                    setDraftFilters((prev) => ({ ...prev, endDate: value }))
                  }
                  placeholder={t("reports.filterEndDate")}
                  maxDateToday
                />
              </View>
            </View>

            <View className="flex-row" style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={resetDraftFilters}
                className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <RotateCcw size={15} color={colors.textSecondary} />
                <Text
                  className="text-sm font-semibold ml-2"
                  style={{ color: colors.textSecondary }}
                >
                  {t("reports.resetFilters")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyFilters}
                className="flex-1 py-3 rounded-xl items-center justify-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: "#FFFFFF" }}
                >
                  {t("reports.applyFilters")}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowScheduleModal(false)}
        >
          <Pressable
            className="rounded-t-3xl p-6"
            style={{ backgroundColor: colors.backgroundPrimary }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                Schedule{" "}
                {scheduleFrequency.charAt(0).toUpperCase() +
                  scheduleFrequency.slice(1)}{" "}
                Report
              </Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              Email Address
            </Text>
            <TextInput
              value={scheduleEmail}
              onChangeText={setScheduleEmail}
              placeholder="Enter email address"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{
                backgroundColor: colors.backgroundSecondary,
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              Format
            </Text>
            <View className="flex-row mb-5" style={{ gap: 8 }}>
              {["pdf", "excel", "csv"].map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  onPress={() => setScheduleFormat(fmt)}
                  className="flex-1 py-2.5 rounded-xl items-center"
                  style={{
                    backgroundColor:
                      scheduleFormat === fmt
                        ? colors.primary + "20"
                        : colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor:
                      scheduleFormat === fmt ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-semibold uppercase"
                    style={{
                      color:
                        scheduleFormat === fmt
                          ? colors.primary
                          : colors.textSecondary,
                    }}
                  >
                    {fmt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleScheduleReport}
              disabled={scheduling}
              className="py-3.5 rounded-xl items-center"
              style={{ backgroundColor: colors.primary }}
            >
              {scheduling ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text
                  className="text-sm font-semibold"
                  style={{ color: "#FFFFFF" }}
                >
                  Schedule Report
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Email Modal */}
      <Modal
        visible={showEmailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowEmailModal(false)}
        >
          <Pressable
            className="rounded-t-3xl p-6"
            style={{ backgroundColor: colors.backgroundPrimary }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                Send Report via Email
              </Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              Email Address
            </Text>
            <TextInput
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="Enter email address"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              className="rounded-xl px-4 py-3 mb-4 text-sm"
              style={{
                backgroundColor: colors.backgroundSecondary,
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              Format
            </Text>
            <View className="flex-row mb-5" style={{ gap: 8 }}>
              {["pdf", "excel", "csv"].map((fmt) => (
                <TouchableOpacity
                  key={fmt}
                  onPress={() => setEmailFormat(fmt)}
                  className="flex-1 py-2.5 rounded-xl items-center"
                  style={{
                    backgroundColor:
                      emailFormat === fmt
                        ? colors.primary + "20"
                        : colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor:
                      emailFormat === fmt ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    className="text-xs font-semibold uppercase"
                    style={{
                      color:
                        emailFormat === fmt
                          ? colors.primary
                          : colors.textSecondary,
                    }}
                  >
                    {fmt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleSendEmail}
              disabled={sendingEmail}
              className="py-3.5 rounded-xl items-center"
              style={{ backgroundColor: colors.purple || "#8B5CF6" }}
            >
              {sendingEmail ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text
                  className="text-sm font-semibold"
                  style={{ color: "#FFFFFF" }}
                >
                  Send Report
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
