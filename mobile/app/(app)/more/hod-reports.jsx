import {
  FileText,
  Download,
  FileSpreadsheet,
  FileBarChart,
  Calendar,
  Clock,
  Mail,
  AlertCircle,
  CheckCircle,
  Trash2,
  X,
  ChevronRight,
  BarChart3,
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
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import FilterPanel from "../../../components/FilterPanel";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import {
  useDepartmentBreakdown,
  useDownloadReport,
  useReportStats,
} from "../../../utils/hooks/useReports";
import { useReportSchedules } from "../../../utils/hooks/useReportSchedules";
import { formatStatusLabel } from "../../../data/complaintStatus";
import getUserAuth from "../../../utils/userAuth";
import { REPORT_EMAIL_URL } from "../../../url";
import apiCall from "../../../utils/api";

function normalizeFilters(filters) {
  const normalized = {};
  if (filters.department !== "" && filters.department !== "all") {
    normalized.department = filters.department;
  }
  if (filters.status !== "" && filters.status !== "all") {
    normalized.status = filters.status;
  }
  if (filters.startDate !== "") normalized.startDate = filters.startDate;
  if (filters.endDate !== "") normalized.endDate = filters.endDate;
  return normalized;
}

const DOWNLOAD_OPTIONS = [
  {
    format: "pdf",
    labelKey: "reports.pdfReport",
    descKey: "reports.pdfDescription",
    icon: FileText,
    colorKey: "danger",
  },
  {
    format: "excel",
    labelKey: "reports.excelReport",
    descKey: "reports.excelDescription",
    icon: FileSpreadsheet,
    colorKey: "success",
  },
  {
    format: "csv",
    labelKey: "reports.csvReport",
    descKey: "reports.csvDescription",
    icon: FileBarChart,
    colorKey: "info",
  },
];

const SCHEDULE_OPTIONS = [
  {
    freq: "daily",
    labelKey: "reports.schedule.dailyLabel",
    descKey: "reports.schedule.dailyDesc",
    icon: Clock,
    colorKey: "primary",
  },
  {
    freq: "weekly",
    labelKey: "reports.schedule.weeklyLabel",
    descKey: "reports.schedule.weeklyDesc",
    icon: Calendar,
    colorKey: "info",
  },
  {
    freq: "monthly",
    labelKey: "reports.schedule.monthlyLabel",
    descKey: "reports.schedule.monthlyDesc",
    icon: BarChart3,
    colorKey: "success",
  },
];

const FREQUENCY_LABEL_KEYS = {
  daily: "reports.schedule.frequency.daily",
  weekly: "reports.schedule.frequency.weekly",
  monthly: "reports.schedule.frequency.monthly",
};

function getFrequencyLabel(t, frequency) {
  const key = FREQUENCY_LABEL_KEYS[frequency];
  if (key == null) {
    return t("reports.notAvailable");
  }
  return t(key);
}

function formatScheduleDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function getScheduleHealthTone(schedule, colors) {
  const status = String(schedule?.health?.lastRunStatus || schedule?.lastRunStatus || "idle");
  if (status === "failed") return colors.danger;
  if (status === "success") return colors.success;
  if (status === "pending") return colors.warning;
  return colors.textSecondary;
}

export default function HODReports() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const insets = useSafeAreaInsets();

  // Tab state
  const [activeTab, setActiveTab] = useState("export"); // "export" or "schedule"

  useEffect(() => {
    getUserAuth().then((user) => {
      const dept = user?.department ?? "";
      setAppliedFilters((prev) => ({ ...prev, department: dept }));
    });
  }, []);

  // Filter states
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState({
    department: "",
    status: "all",
    startDate: "",
    endDate: "",
  });

  // Schedule states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  const [scheduleFormat, setScheduleFormat] = useState("pdf");
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
  const {
    schedules: activeSchedules,
    isLoading: loadingSchedules,
    createSchedule,
    cancelSchedule,
    runScheduleNow,
    scheduling,
    cancellingId,
    runningNowId,
  } = useReportSchedules(t);
  const {
    data: reportStats,
    isLoading: loadingStats,
  } = useReportStats(normalizedFilters, {
    enabled: activeTab === "export",
  });
  const {
    data: departmentBreakdown,
    isLoading: loadingBreakdown,
  } = useDepartmentBreakdown(normalizedFilters, {
    enabled: activeTab === "export",
  });

  const departmentCards = useMemo(() => {
    const entries = Object.entries(departmentBreakdown ?? {});
    return entries
      .map(([department, stats]) => ({
        department,
        total: Number(stats?.total ?? 0),
        resolved: Number(stats?.resolved ?? 0),
        pending:
          Number(stats?.pending ?? 0) + Number(stats?.inProgress ?? 0),
        highPriority: Number(stats?.highPriority ?? 0),
      }))
      .sort((left, right) => right.total - left.total);
  }, [departmentBreakdown]);
  const maxDepartmentTotal = departmentCards[0]?.total ?? 0;

  const hasActiveFilters = useMemo(() => {
    const flags = [
      appliedFilters.status !== "all",
      appliedFilters.startDate !== "",
      appliedFilters.endDate !== "",
    ];
    return flags.some(Boolean);
  }, [appliedFilters]);

  const statusSummary =
    appliedFilters.status !== "all"
      ? t("reports.filterSummary.status", {
          value: formatStatusLabel(t, appliedFilters.status),
        })
      : null;
  const fromSummary =
    appliedFilters.startDate !== ""
      ? t("reports.filterSummary.from", { date: appliedFilters.startDate })
      : null;
  const toSummary =
    appliedFilters.endDate !== ""
      ? t("reports.filterSummary.to", { date: appliedFilters.endDate })
      : null;
  const filterSummary = [statusSummary, fromSummary, toSummary]
    .filter((value) => value != null)
    .join(", ");

  const scheduleEmailTrimmed = scheduleEmail.trim();
  const emailAddressTrimmed = emailAddress.trim();
  const isScheduleEmailInvalid =
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(scheduleEmailTrimmed);
  const isEmailAddressInvalid =
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddressTrimmed);

  const downloadReport = async (format) => {
    try {
      setDownloadingFormat(format);
      await download({ format, filters: normalizedFilters });
      Toast.show({
        type: "success",
        text1: t("reports.reportGenerated"),
        text2: t("reports.reportReady", { format: format.toUpperCase() }),
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: error?.response?.data?.message ?? t("reports.generateFailed"),
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleScheduleReport = async () => {
    if (isScheduleEmailInvalid) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: t("reports.invalidEmail"),
      });
      return;
    }

    const departmentValue =
      appliedFilters.department !== "all" ? appliedFilters.department : undefined;
    const statusValue =
      appliedFilters.status !== "all" ? appliedFilters.status : undefined;
    const startDateValue =
      appliedFilters.startDate !== "" ? appliedFilters.startDate : undefined;
    const endDateValue =
      appliedFilters.endDate !== "" ? appliedFilters.endDate : undefined;

    try {
      const ok = await createSchedule(
        {
          email: scheduleEmailTrimmed,
          frequency: scheduleFrequency,
          format: scheduleFormat,
          department: departmentValue,
          status: statusValue,
          startDate: startDateValue,
          endDate: endDateValue,
        },
        getFrequencyLabel(t, scheduleFrequency),
      );
      if (ok) {
        setShowScheduleModal(false);
        setScheduleEmail("");
        setScheduleFrequency("weekly");
        setScheduleFormat("pdf");
      }
    } finally {
    }
  };

  const handleCancelSchedule = async (scheduleId) => {
    await cancelSchedule(scheduleId);
  };

  const handleRunScheduleNow = async (scheduleId) => {
    await runScheduleNow(scheduleId);
  };

  const handleSendEmail = async () => {
    if (isEmailAddressInvalid) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: t("reports.invalidEmail"),
      });
      return;
    }

    const departmentValue =
      appliedFilters.department !== "all" ? appliedFilters.department : undefined;
    const statusValue =
      appliedFilters.status !== "all" ? appliedFilters.status : undefined;
    const startDateValue =
      appliedFilters.startDate !== "" ? appliedFilters.startDate : undefined;
    const endDateValue =
      appliedFilters.endDate !== "" ? appliedFilters.endDate : undefined;

    try {
      setSendingEmail(true);
      await apiCall({
        method: "POST",
        url: REPORT_EMAIL_URL,
        data: {
          email: emailAddressTrimmed,
          format: emailFormat,
          department: departmentValue,
          status: statusValue,
          startDate: startDateValue,
          endDate: endDateValue,
        },
      });

      Toast.show({
        type: "success",
        text1: t("reports.email.sentTitle"),
        text2: t("reports.email.sentMessage", { email: emailAddressTrimmed }),
      });

      setShowEmailModal(false);
      setEmailAddress("");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: error?.response?.data?.message ?? t("reports.email.sendFailed"),
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
          {/* Filter Panel */}
          <FilterPanel
            variant="bar"
            statusFilter={appliedFilters.status}
            setStatusFilter={(val) =>
              setAppliedFilters((prev) => ({ ...prev, status: val }))
            }
            startDate={appliedFilters.startDate}
            endDate={appliedFilters.endDate}
            setStartDate={(val) =>
              setAppliedFilters((prev) => ({ ...prev, startDate: val }))
            }
            setEndDate={(val) =>
              setAppliedFilters((prev) => ({ ...prev, endDate: val }))
            }
            hasActiveFilters={hasActiveFilters}
            summary={filterSummary}
            t={t}
            style={{ marginBottom: 16 }}
          />

          {/* Tab Navigator */}
          <View
            className="flex-row rounded-2xl p-1 mb-4"
            style={{ backgroundColor: colors.backgroundSecondary }}
          >
            <TouchableOpacity
              onPress={() => setActiveTab("export")}
              className="flex-1 py-3 rounded-xl items-center"
              style={{
                backgroundColor: activeTab === "export" ? colors.primary : undefined,
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color: activeTab === "export" ? colors.light : colors.textSecondary,
                }}
              >
                {t("reports.tabs.export")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab("schedule")}
              className="flex-1 py-3 rounded-xl items-center"
              style={{
                backgroundColor:
                  activeTab === "schedule" ? colors.primary : undefined,
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color:
                    activeTab === "schedule" ? colors.light : colors.textSecondary,
                }}
              >
                {t("reports.tabs.schedule")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Export Tab Content */}
          {activeTab === "export" && (
            <>
              <View className="mb-4">
                <Text
                  className="text-xs font-semibold uppercase mb-3"
                  style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
                >
                  {t("reports.sections.analytics")}
                </Text>
                <View
                  className="rounded-2xl p-4 mb-3"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {(loadingStats || loadingBreakdown) && !reportStats ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                          <Text
                            className="text-xs mb-1"
                            style={{ color: colors.textSecondary }}
                          >
                            {t("reports.totalComplaints")}
                          </Text>
                          <Text
                            className="text-2xl font-bold"
                            style={{ color: colors.textPrimary }}
                          >
                            {Number(reportStats?.total ?? 0)}
                          </Text>
                        </View>
                        <View className="flex-1 mx-2">
                          <Text
                            className="text-xs mb-1"
                            style={{ color: colors.textSecondary }}
                          >
                            {t("reports.resolved")}
                          </Text>
                          <Text
                            className="text-2xl font-bold"
                            style={{ color: colors.success }}
                          >
                            {Number(reportStats?.byStatus?.resolved ?? 0)}
                          </Text>
                        </View>
                        <View className="flex-1 ml-2">
                          <Text
                            className="text-xs mb-1"
                            style={{ color: colors.textSecondary }}
                          >
                            {t("reports.pending")}
                          </Text>
                          <Text
                            className="text-2xl font-bold"
                            style={{ color: colors.warning }}
                          >
                            {Number(reportStats?.byStatus?.pending ?? 0) +
                              Number(reportStats?.byStatus?.["in-progress"] ?? 0)}
                          </Text>
                        </View>
                      </View>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("reports.breakdown.description")}
                      </Text>
                    </>
                  )}
                </View>

                <View
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {departmentCards.length > 0 ? (
                    departmentCards.map((item, idx) => {
                      const totalRatio =
                        maxDepartmentTotal > 0 ? item.total / maxDepartmentTotal : 0;
                      const resolvedRatio =
                        item.total > 0 ? item.resolved / item.total : 0;
                      return (
                        <View key={item.department}>
                          <View className="px-4 py-3.5">
                            <View className="flex-row items-center justify-between mb-2">
                              <Text
                                className="text-sm font-semibold flex-1 mr-3"
                                style={{ color: colors.textPrimary }}
                              >
                                {item.department}
                              </Text>
                              <Text
                                className="text-xs font-semibold"
                                style={{ color: colors.textSecondary }}
                              >
                                {t("reports.breakdown.totalLabel", {
                                  count: item.total,
                                })}
                              </Text>
                            </View>
                            <View
                              className="h-2 rounded-full overflow-hidden mb-2"
                              style={{ backgroundColor: colors.border }}
                            >
                              <View
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(totalRatio * 100, 6)}%`,
                                  backgroundColor: colors.primary,
                                }}
                              />
                            </View>
                            <View className="flex-row items-center justify-between">
                              <Text
                                className="text-xs"
                                style={{ color: colors.success }}
                              >
                                {t("reports.breakdown.resolvedLabel", {
                                  count: item.resolved,
                                })}
                              </Text>
                              <Text
                                className="text-xs"
                                style={{ color: colors.warning }}
                              >
                                {t("reports.breakdown.pendingLabel", {
                                  count: item.pending,
                                })}
                              </Text>
                              <Text
                                className="text-xs"
                                style={{ color: colors.danger }}
                              >
                                {t("reports.breakdown.highPriorityLabel", {
                                  count: item.highPriority,
                                })}
                              </Text>
                            </View>
                            <View
                              className="h-1.5 rounded-full overflow-hidden mt-2"
                              style={{ backgroundColor: colors.border }}
                            >
                              <View
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(resolvedRatio * 100, 4)}%`,
                                  backgroundColor: colors.success,
                                }}
                              />
                            </View>
                          </View>
                          {idx < departmentCards.length - 1 && (
                            <View
                              className="h-[1px] ml-4"
                              style={{ backgroundColor: colors.border }}
                            />
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <View className="px-4 py-5">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("reports.breakdown.empty")}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Download Reports */}
              <View className="mb-4">
                <Text
                  className="text-xs font-semibold uppercase mb-3"
                  style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
                >
                  {t("reports.sections.download")}
                </Text>
                <View
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {DOWNLOAD_OPTIONS.map(
                    ({ format, labelKey, descKey, icon: Icon, colorKey }, idx, arr) => {
                      const color = colors[colorKey] ?? colors.primary;
                      return (
                      <View key={format}>
                        <TouchableOpacity
                          onPress={() => downloadReport(format)}
                          disabled={Boolean(downloadingFormat)}
                          activeOpacity={0.6}
                          className="flex-row items-center px-4 py-3.5"
                        >
                          <View
                            className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                            style={{ backgroundColor: color + "20" }}
                          >
                            <Icon size={17} color={color} />
                          </View>
                          <View className="flex-1">
                            <Text
                              className="text-sm font-semibold"
                              style={{ color: colors.textPrimary }}
                            >
                              {t(labelKey)}
                            </Text>
                            <Text
                              className="text-xs mt-0.5"
                              style={{ color: colors.textSecondary }}
                            >
                              {t(descKey)}
                            </Text>
                          </View>
                          {downloadingFormat === format ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.primary}
                            />
                          ) : (
                            <Download size={17} color={colors.textSecondary} />
                          )}
                        </TouchableOpacity>
                        {idx < arr.length - 1 && (
                          <View
                            className="h-[1px] ml-14"
                            style={{ backgroundColor: colors.border }}
                          />
                        )}
                      </View>
                    );
                    },
                  )}
                </View>
              </View>

              {/* Email Report */}
              <View className="mb-4">
                <Text
                  className="text-xs font-semibold uppercase mb-3"
                  style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
                >
                  {t("reports.sections.email")}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowEmailModal(true)}
                  activeOpacity={0.6}
                  className="rounded-2xl flex-row items-center px-4 py-3.5"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                    style={{
                      backgroundColor: colors.info + "20",
                    }}
                  >
                    <Mail size={17} color={colors.info} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.textPrimary }}
                    >
                      {t("reports.email.cardTitle")}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("reports.email.cardDescription")}
                    </Text>
                  </View>
                  <ChevronRight size={17} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Schedule Tab Content */}
          {activeTab === "schedule" && (
            <>
              <View className="mb-4">
                <View className="flex-row items-center mb-3">
                  <Text
                    className="text-xs font-semibold uppercase flex-1"
                    style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
                  >
                    {t("reports.sections.automated")}
                  </Text>
                  {loadingSchedules && (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </View>

                <View
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {SCHEDULE_OPTIONS.map(
                    ({ freq, labelKey, descKey, icon: Icon, colorKey }, idx, arr) => {
                      const color = colors[colorKey] ?? colors.primary;
                      const existing = activeSchedules.find(
                        (s) => s.frequency === freq && s.isActive,
                      );
                      const healthColor = getScheduleHealthTone(existing, colors);
                      const nextRunAt = formatScheduleDateTime(
                        existing?.health?.nextRunAt || existing?.nextRunAt,
                      );
                      const lastSuccessAt = formatScheduleDateTime(
                        existing?.health?.lastSuccessAt || existing?.lastSentAt,
                      );
                      const lastFailureAt = formatScheduleDateTime(
                        existing?.health?.lastFailureAt || existing?.lastFailureAt,
                      );
                      const lastError = existing?.health?.lastError || existing?.lastError;
                      const lastErrorStage =
                        existing?.health?.lastErrorStage ||
                        existing?.lastErrorStage ||
                        null;
                      const healthStatusKey =
                        existing?.health?.lastRunStatus || existing?.lastRunStatus || "idle";
                      return (
                        <View key={freq}>
                          <View className="px-4 py-3.5">
                            <View className="flex-row items-center">
                            <View
                              className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                              style={{
                                backgroundColor: existing
                                  ? color + "25"
                                  : color + "18",
                              }}
                            >
                              {existing ? (
                                <CheckCircle size={17} color={color} />
                              ) : (
                                <Icon size={17} color={color} />
                              )}
                            </View>
                            <View className="flex-1">
                              <Text
                                className="text-sm font-semibold"
                                style={{
                                  color: existing ? color : colors.textPrimary,
                                }}
                                >
                                  {t(labelKey)} {t("reports.schedule.reportsSuffix")}
                                </Text>
                              {existing ? (
                                <>
                                  <Text
                                    className="text-xs mt-0.5"
                                    style={{ color: colors.textSecondary }}
                                  >
                                    {t("reports.schedule.activeMeta", {
                                      email:
                                        existing.email ?? t("reports.notAvailable"),
                                      format:
                                        existing.format != null
                                          ? String(existing.format).toUpperCase()
                                          : t("reports.notAvailable"),
                                    })}
                                  </Text>
                                  <View className="flex-row items-center mt-2">
                                    <View
                                      className="px-2 py-1 rounded-full"
                                      style={{ backgroundColor: `${healthColor}20` }}
                                    >
                                      <Text
                                        className="text-[10px] font-semibold uppercase"
                                        style={{ color: healthColor }}
                                      >
                                        {t(`reports.schedule.health.status.${healthStatusKey}`)}
                                      </Text>
                                    </View>
                                  </View>
                                  <View className="mt-2">
                                    <Text
                                      className="text-xs"
                                      style={{ color: colors.textSecondary }}
                                    >
                                      {t("reports.schedule.health.nextRun", {
                                        value:
                                          nextRunAt ?? t("reports.notAvailable"),
                                      })}
                                    </Text>
                                    <Text
                                      className="text-xs mt-1"
                                      style={{ color: colors.textSecondary }}
                                    >
                                      {t("reports.schedule.health.lastSuccess", {
                                        value:
                                          lastSuccessAt ?? t("reports.notAvailable"),
                                      })}
                                    </Text>
                                    <Text
                                      className="text-xs mt-1"
                                      style={{
                                        color: lastFailureAt
                                          ? colors.danger
                                          : colors.textSecondary,
                                      }}
                                    >
                                      {t("reports.schedule.health.lastFailure", {
                                        value:
                                          lastFailureAt ?? t("reports.notAvailable"),
                                      })}
                                    </Text>
                                    {lastError ? (
                                      <Text
                                        className="text-xs mt-1"
                                        style={{ color: colors.danger }}
                                      >
                                        {t("reports.schedule.health.error", {
                                          stage: lastErrorStage
                                            ? t(
                                                `reports.schedule.health.stages.${lastErrorStage}`,
                                              )
                                            : t("reports.notAvailable"),
                                          value: lastError,
                                        })}
                                      </Text>
                                    ) : null}
                                  </View>
                                </>
                              ) : (
                                <Text
                                  className="text-xs mt-0.5"
                                  style={{ color: colors.textSecondary }}
                                >
                                  {t(descKey)}
                                </Text>
                              )}
                            </View>
                            {existing ? (
                              <View className="items-end ml-3">
                                <TouchableOpacity
                                  onPress={() =>
                                    handleRunScheduleNow(existing._id)
                                  }
                                  disabled={runningNowId === existing._id}
                                  className="px-3 py-1.5 rounded-lg mb-2"
                                  style={{ backgroundColor: colors.primary + "18" }}
                                >
                                  {runningNowId === existing._id ? (
                                    <ActivityIndicator
                                      size="small"
                                      color={colors.primary}
                                    />
                                  ) : (
                                    <Text
                                      className="text-xs font-semibold"
                                      style={{ color: colors.primary }}
                                    >
                                      {t("reports.schedule.runNow")}
                                    </Text>
                                  )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() =>
                                    handleCancelSchedule(existing._id)
                                  }
                                  disabled={cancellingId === existing._id}
                                  hitSlop={{
                                    top: 8,
                                    bottom: 8,
                                    left: 8,
                                    right: 8,
                                  }}
                                >
                                  {cancellingId === existing._id ? (
                                    <ActivityIndicator
                                      size="small"
                                      color={colors.danger}
                                    />
                                  ) : (
                                    <Trash2 size={16} color={colors.danger} />
                                  )}
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                onPress={() => {
                                  setScheduleFrequency(freq);
                                  setShowScheduleModal(true);
                                }}
                                className="px-3 py-1.5 rounded-lg"
                                style={{ backgroundColor: color + "18" }}
                              >
                                <Text
                                  className="text-xs font-semibold"
                                  style={{ color }}
                                >
                                  {t("reports.schedule.setUp")}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          </View>
                          {idx < arr.length - 1 && (
                            <View
                              className="h-[1px] ml-14"
                              style={{ backgroundColor: colors.border }}
                            />
                          )}
                        </View>
                      );
                    },
                  )}
                </View>
              </View>

              <View
                className="flex-row items-start rounded-2xl px-4 py-3"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <AlertCircle
                  size={15}
                  color={colors.textSecondary}
                  style={{ marginTop: 1 }}
                />
                <Text
                  className="text-xs ml-2.5 flex-1 leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  {t("reports.schedule.info")}
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.dark + "80" }}
          onPress={() => setShowScheduleModal(false)}
        >
          <Pressable
            className="rounded-t-3xl px-6 pt-6"
            style={{
              backgroundColor: colors.backgroundPrimary,
              paddingBottom: Math.max(insets.bottom + 16, 24),
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                {t("reports.schedule.modalTitle", {
                  frequency: getFrequencyLabel(t, scheduleFrequency),
                })}
              </Text>
              <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("reports.emailAddressLabel")}
            </Text>
            <PaperTextInput
              mode="flat"
              value={scheduleEmail}
              onChangeText={setScheduleEmail}
              placeholder={t("reports.emailPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                marginBottom: 16,
                backgroundColor: colors.backgroundSecondary,
                color: colors.textPrimary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              contentStyle={{
                color: colors.textPrimary,
                fontSize: 14,
                paddingHorizontal: 16,
              }}
              underlineStyle={{ display: "none" }}
              theme={{ colors: { text: colors.textPrimary } }}
            />

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("reports.formatLabel")}
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
                <ActivityIndicator size="small" color={colors.light} />
              ) : (
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.light }}
                >
                  {t("reports.schedule.cta")}
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
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.dark + "80" }}
          onPress={() => setShowEmailModal(false)}
        >
          <Pressable
            className="rounded-t-3xl px-6 pt-6"
            style={{
              backgroundColor: colors.backgroundPrimary,
              paddingBottom: Math.max(insets.bottom + 16, 24),
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                {t("reports.email.modalTitle")}
              </Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("reports.emailAddressLabel")}
            </Text>
            <PaperTextInput
              mode="flat"
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder={t("reports.emailPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                marginBottom: 16,
                backgroundColor: colors.backgroundSecondary,
                color: colors.textPrimary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              contentStyle={{
                color: colors.textPrimary,
                fontSize: 14,
                paddingHorizontal: 16,
              }}
              underlineStyle={{ display: "none" }}
              theme={{ colors: { text: colors.textPrimary } }}
            />

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("reports.formatLabel")}
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
              style={{ backgroundColor: colors.info }}
            >
              {sendingEmail ? (
                <ActivityIndicator size="small" color={colors.light} />
              ) : (
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.light }}
                >
                  {t("reports.email.cta")}
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
