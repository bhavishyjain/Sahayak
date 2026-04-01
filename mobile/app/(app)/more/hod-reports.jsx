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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import AppTextInput from "../../../components/AppTextInput";
import BackButtonHeader from "../../../components/BackButtonHeader";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useDownloadReport } from "../../../utils/hooks/useReports";
import { useReportSchedules } from "../../../utils/hooks/useReportSchedules";
import { useHodReportsDashboard } from "../../../utils/hooks/useHodReportsDashboard";
import {
  ALL_STATUS_OPTIONS,
  formatStatusLabel,
} from "../../../data/complaintStatus";
import getUserAuth from "../../../utils/userAuth";
import { REPORT_EMAIL_URL } from "../../../url";
import apiCall from "../../../utils/api";

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

const FORMAT_LABEL_KEYS = {
  pdf: "reports.formats.pdf",
  excel: "reports.formats.excel",
  csv: "reports.formats.csv",
};
const RANGE_OPTION_KEYS = {
  "24h": "reports.scope.range24h",
  "7d": "reports.scope.range7d",
  "30d": "reports.scope.range30d",
  custom: "reports.scope.rangeCustom",
};
const RANGE_DESCRIPTION_KEYS = {
  "24h": "reports.scope.range24hDesc",
  "7d": "reports.scope.range7dDesc",
  "30d": "reports.scope.range30dDesc",
  custom: "reports.scope.rangeCustomDesc",
};
const RANGE_OPTIONS = ["24h", "7d", "30d", "custom"];

function getFrequencyLabel(t, frequency) {
  const key = FREQUENCY_LABEL_KEYS[frequency];
  if (key == null) {
    return t("reports.notAvailable");
  }
  return t(key);
}

function getFormatLabel(t, format) {
  const key = FORMAT_LABEL_KEYS[format];
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
  const status = String(
    schedule?.health?.lastRunStatus || schedule?.lastRunStatus || "idle",
  );
  if (status === "failed") return colors.danger;
  if (status === "success") return colors.success;
  if (status === "pending") return colors.warning;
  return colors.textSecondary;
}

function formatDateInput(value) {
  return String(value || "").trim();
}

function isValidDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(formatDateInput(value));
}

function getDateRangeForPreset(range) {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now);

  if (range === "24h") {
    start.setDate(start.getDate() - 1);
  } else if (range === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 30);
  } else {
    return { startDate: "", endDate: "" };
  }

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate,
  };
}

function getReportFiltersFromScope({
  department,
  status,
  range,
  startDate,
  endDate,
}) {
  const resolvedRange =
    range === "custom"
      ? {
          startDate: formatDateInput(startDate),
          endDate: formatDateInput(endDate),
        }
      : getDateRangeForPreset(range);

  return {
    department,
    status: status === "all" ? "" : status,
    startDate: resolvedRange.startDate,
    endDate: resolvedRange.endDate,
  };
}

function getRangeLabel(t, range) {
  return t(RANGE_OPTION_KEYS[range] || RANGE_OPTION_KEYS["7d"]);
}

function inferRangeFromScheduleFilters(filters = {}) {
  const preset = String(filters?.rangePreset || "").trim();
  if (RANGE_OPTIONS.includes(preset)) return preset;
  const startDate = formatDateInput(
    filters?.createdAt?.$gte || filters?.startDate,
  );
  const endDate = formatDateInput(filters?.createdAt?.$lte || filters?.endDate);
  const today = new Date().toISOString().slice(0, 10);

  if (endDate === today) {
    const diffDays = Math.round(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (diffDays === 1) return "24h";
    if (diffDays === 7) return "7d";
    if (diffDays === 30) return "30d";
  }

  return "custom";
}

function getScheduleRangeSummary(filters = {}, t) {
  const range = inferRangeFromScheduleFilters(filters);
  const resolved =
    range === "custom"
      ? {
          startDate: formatDateInput(
            filters?.createdAt?.$gte || filters?.startDate,
          ),
          endDate: formatDateInput(
            filters?.createdAt?.$lte || filters?.endDate,
          ),
        }
      : getDateRangeForPreset(range);
  const startDate = resolved.startDate;
  const endDate = resolved.endDate;

  const parts = [getRangeLabel(t, range)];
  if (startDate && endDate) {
    parts.push(`${startDate} to ${endDate}`);
  }

  return (
    parts.join(" (").replace(/\($/, "") + (startDate && endDate ? ")" : "")
  );
}

function ScopeSelector({ scope, setScope, t, colors, summary }) {
  const statusOptions = useMemo(() => ["all", ...ALL_STATUS_OPTIONS], []);

  return (
    <>
      <Text className="text-xs mb-2" style={{ color: colors.textSecondary }}>
        {t("reports.scope.dateRangeLabel")}
      </Text>
      <View className="flex-row flex-wrap mb-2">
        {RANGE_OPTIONS.map((range) => {
          const selected = scope.range === range;
          return (
            <TouchableOpacity
              key={range}
              onPress={() => setScope((prev) => ({ ...prev, range }))}
              className="mr-2 mb-2 rounded-full px-3 py-2"
              style={{
                backgroundColor: selected
                  ? `${colors.primary}18`
                  : colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{
                  color: selected ? colors.primary : colors.textPrimary,
                }}
              >
                {getRangeLabel(t, range)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text
        className="text-xs mb-3"
        style={{ color: colors.textSecondary, lineHeight: 18 }}
      >
        {t(RANGE_DESCRIPTION_KEYS[scope.range])}
      </Text>

      {scope.range === "custom" ? (
        <View className="flex-row mb-4" style={{ gap: 8 }}>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={scope.startDate}
              onChange={(startDate) =>
                setScope((prev) => ({ ...prev, startDate }))
              }
              icon={Calendar}
              placeholder={t("reports.filterStartDate")}
              maxDateToday={true}
              containerStyle={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 0,
              }}
            />
          </View>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={scope.endDate}
              onChange={(endDate) => setScope((prev) => ({ ...prev, endDate }))}
              icon={Calendar}
              placeholder={t("reports.filterEndDate")}
              maxDateToday={true}
              containerStyle={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 0,
              }}
            />
          </View>
        </View>
      ) : null}

      <Text className="text-xs mb-2" style={{ color: colors.textSecondary }}>
        {t("reports.scope.statusLabel")}
      </Text>
      <View className="flex-row flex-wrap mb-4">
        {statusOptions.map((status) => {
          const selected = scope.status === status;
          return (
            <TouchableOpacity
              key={status}
              onPress={() => setScope((prev) => ({ ...prev, status }))}
              className="mr-2 mb-2 rounded-full px-3 py-2"
              style={{
                backgroundColor: selected
                  ? `${colors.primary}18`
                  : colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{
                  color: selected ? colors.primary : colors.textPrimary,
                }}
              >
                {status === "all"
                  ? t("reports.scope.allStatuses")
                  : formatStatusLabel(t, status)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        className="rounded-2xl px-3 py-3 mb-4"
        style={{ backgroundColor: colors.backgroundSecondary }}
      >
        <Text
          className="text-[11px] uppercase mb-1"
          style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
        >
          {t("reports.scope.includedLabel")}
        </Text>
        <Text
          className="text-xs"
          style={{ color: colors.textPrimary, lineHeight: 18 }}
        >
          {summary}
        </Text>
      </View>
    </>
  );
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
      setReportScope((prev) => ({ ...prev, department: dept }));
    });
  }, []);

  // Report scope states
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [pendingDownloadFormat, setPendingDownloadFormat] = useState("pdf");
  const [reportScope, setReportScope] = useState({
    department: "",
    status: "all",
    range: "24h",
    startDate: "",
    endDate: "",
  });

  // Schedule states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleEmail, setScheduleEmail] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  const [scheduleFormat, setScheduleFormat] = useState("pdf");
  const [scheduleScope, setScheduleScope] = useState({
    status: "all",
    range: "24h",
    startDate: "",
    endDate: "",
  });
  // Email report states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailFormat, setEmailFormat] = useState("pdf");
  const [sendingEmail, setSendingEmail] = useState(false);
  const computedReportFilters = useMemo(
    () => getReportFiltersFromScope(reportScope),
    [reportScope],
  );

  const { download } = useDownloadReport();
  const { normalizedFilters, error: reportsError } = useHodReportsDashboard(
    computedReportFilters,
  );
  const {
    schedules: activeSchedules,
    isLoading: loadingSchedules,
    createSchedule,
    cancelSchedule,
    scheduling,
    cancellingId,
  } = useReportSchedules(t);
  const statusSummary =
    reportScope.status !== "all"
      ? t("reports.filterSummary.status", {
          value: formatStatusLabel(t, reportScope.status),
        })
      : null;
  const rangeSummary = t("reports.filterSummary.range", {
    value: getRangeLabel(t, reportScope.range),
  });
  const fromSummary =
    computedReportFilters.startDate !== ""
      ? t("reports.filterSummary.from", {
          date: computedReportFilters.startDate,
        })
      : null;
  const toSummary =
    computedReportFilters.endDate !== ""
      ? t("reports.filterSummary.to", { date: computedReportFilters.endDate })
      : null;
  const filterSummary = [rangeSummary, statusSummary, fromSummary, toSummary]
    .filter((value) => value != null)
    .join(", ");
  const scheduleFiltersPreview = useMemo(
    () =>
      getReportFiltersFromScope({
        department: reportScope.department,
        status: scheduleScope.status,
        range: scheduleScope.range,
        startDate: scheduleScope.startDate,
        endDate: scheduleScope.endDate,
      }),
    [reportScope.department, scheduleScope],
  );
  const scheduleSummary = [
    t("reports.filterSummary.range", {
      value: getRangeLabel(t, scheduleScope.range),
    }),
    scheduleScope.status !== "all"
      ? t("reports.filterSummary.status", {
          value: formatStatusLabel(t, scheduleScope.status),
        })
      : null,
    scheduleFiltersPreview.startDate
      ? t("reports.filterSummary.from", {
          date: scheduleFiltersPreview.startDate,
        })
      : null,
    scheduleFiltersPreview.endDate
      ? t("reports.filterSummary.to", {
          date: scheduleFiltersPreview.endDate,
        })
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    if (!reportsError) return;
    Toast.show({
      type: "error",
      text1: t("toast.error.title"),
      text2:
        reportsError?.response?.data?.message ?? t("reports.generateFailed"),
    });
  }, [reportsError, t]);

  const scheduleEmailTrimmed = scheduleEmail.trim();
  const emailAddressTrimmed = emailAddress.trim();
  const isScheduleEmailInvalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    scheduleEmailTrimmed,
  );
  const isEmailAddressInvalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    emailAddressTrimmed,
  );
  const reportDateInvalid =
    reportScope.range === "custom" &&
    (!isValidDateInput(reportScope.startDate) ||
      !isValidDateInput(reportScope.endDate));
  const scheduleDateInvalid =
    scheduleScope.range === "custom" &&
    (!isValidDateInput(scheduleScope.startDate) ||
      !isValidDateInput(scheduleScope.endDate));

  function showDateRequiredError() {
    Toast.show({
      type: "error",
      text1: t("toast.error.title"),
      text2: t("reports.scope.customDateRequired"),
    });
  }

  const openDownloadModal = (format) => {
    setPendingDownloadFormat(format);
    setShowDownloadModal(true);
  };

  const downloadReport = async (format) => {
    if (reportDateInvalid) {
      showDateRequiredError();
      return;
    }

    try {
      setDownloadingFormat(format);
      const result = await download({ format, filters: normalizedFilters });
      Toast.show({
        type: "success",
        text1: t("reports.reportGenerated"),
        text2:
          result?.opened === false
            ? `${t("reports.reportReady", { format: format.toUpperCase() })}: ${result?.fileName || "file"}. Could not auto-open; open it from your file manager.`
            : result?.fileName
              ? `${t("reports.reportReady", { format: format.toUpperCase() })}: ${result.fileName}`
              : t("reports.reportReady", { format: format.toUpperCase() }),
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2:
          error?.response?.data?.message ||
          error?.message ||
          t("reports.generateFailed"),
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleConfirmDownload = async () => {
    if (reportDateInvalid) {
      showDateRequiredError();
      return;
    }

    setShowDownloadModal(false);
    await downloadReport(pendingDownloadFormat);
  };

  const handleScheduleReport = async () => {
    if (!scheduleEmailTrimmed) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: t("reports.emailRequired"),
      });
      return;
    }

    if (isScheduleEmailInvalid) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: t("reports.invalidEmail"),
      });
      return;
    }

    if (scheduleDateInvalid) {
      showDateRequiredError();
      return;
    }

    const scheduleFilters = getReportFiltersFromScope({
      department: reportScope.department,
      status: scheduleScope.status,
      range: scheduleScope.range,
      startDate: scheduleScope.startDate,
      endDate: scheduleScope.endDate,
    });
    const departmentValue =
      scheduleFilters.department !== "all"
        ? scheduleFilters.department
        : undefined;
    const statusValue = scheduleFilters.status || undefined;
    const startDateValue =
      scheduleFilters.startDate !== "" ? scheduleFilters.startDate : undefined;
    const endDateValue =
      scheduleFilters.endDate !== "" ? scheduleFilters.endDate : undefined;

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
          rangePreset: scheduleScope.range,
        },
        getFrequencyLabel(t, scheduleFrequency),
      );
      if (ok) {
        setShowScheduleModal(false);
        setScheduleEmail("");
        setScheduleFrequency("weekly");
        setScheduleFormat("pdf");
        setScheduleScope({
          status: "all",
          range: "24h",
          startDate: "",
          endDate: "",
        });
      }
    } finally {
    }
  };

  const handleCancelSchedule = async (scheduleId) => {
    await cancelSchedule(scheduleId);
  };

  const handleSendEmail = async () => {
    if (!emailAddressTrimmed) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: t("reports.emailRequired"),
      });
      return;
    }

    if (isEmailAddressInvalid) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: t("reports.invalidEmail"),
      });
      return;
    }

    if (reportDateInvalid) {
      showDateRequiredError();
      return;
    }

    const departmentValue =
      computedReportFilters.department !== "all"
        ? computedReportFilters.department
        : undefined;
    const statusValue = computedReportFilters.status || undefined;
    const startDateValue =
      computedReportFilters.startDate !== ""
        ? computedReportFilters.startDate
        : undefined;
    const endDateValue =
      computedReportFilters.endDate !== ""
        ? computedReportFilters.endDate
        : undefined;

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
                  activeTab === "export" ? colors.primary : undefined,
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color:
                    activeTab === "export"
                      ? colors.light
                      : colors.textSecondary,
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
                    activeTab === "schedule"
                      ? colors.light
                      : colors.textSecondary,
                }}
              >
                {t("reports.tabs.schedule")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Export Tab Content */}
          {activeTab === "export" && (
            <>
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
                    (
                      { format, labelKey, descKey, icon: Icon, colorKey },
                      idx,
                      arr,
                    ) => {
                      const color = colors[colorKey] ?? colors.primary;
                      return (
                        <View key={format}>
                          <TouchableOpacity
                            onPress={() => openDownloadModal(format)}
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
                              <Download
                                size={17}
                                color={colors.textSecondary}
                              />
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
                    (
                      { freq, labelKey, descKey, icon: Icon, colorKey },
                      idx,
                      arr,
                    ) => {
                      const color = colors[colorKey] ?? colors.primary;
                      const existing = activeSchedules.find(
                        (s) => s.frequency === freq && s.isActive,
                      );
                      const healthColor = getScheduleHealthTone(
                        existing,
                        colors,
                      );
                      const nextRunAt = formatScheduleDateTime(
                        existing?.health?.nextRunAt || existing?.nextRunAt,
                      );
                      const lastSuccessAt = formatScheduleDateTime(
                        existing?.health?.lastSuccessAt || existing?.lastSentAt,
                      );
                      const lastFailureAt = formatScheduleDateTime(
                        existing?.health?.lastFailureAt ||
                          existing?.lastFailureAt,
                      );
                      const lastError =
                        existing?.health?.lastError || existing?.lastError;
                      const lastErrorStage =
                        existing?.health?.lastErrorStage ||
                        existing?.lastErrorStage ||
                        null;
                      const healthStatusKey =
                        existing?.health?.lastRunStatus ||
                        existing?.lastRunStatus ||
                        "idle";
                      return (
                        <View key={freq}>
                          <View className="px-4 py-3.5">
                            <View className="flex-row items-start">
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
                                <View className="flex-row items-start justify-between">
                                  <Text
                                    className="text-sm font-semibold flex-1 pr-3"
                                    style={{
                                      color: existing
                                        ? color
                                        : colors.textPrimary,
                                    }}
                                  >
                                    {t(labelKey)}{" "}
                                    {t("reports.schedule.reportsSuffix")}
                                  </Text>
                                  {existing ? (
                                    <View
                                      className="px-2 py-1 rounded-full"
                                      style={{
                                        backgroundColor: `${healthColor}20`,
                                      }}
                                    >
                                      <Text
                                        className="text-[10px] font-semibold uppercase"
                                        style={{ color: healthColor }}
                                      >
                                        {t(
                                          `reports.schedule.health.status.${healthStatusKey}`,
                                        )}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                                {existing ? (
                                  <>
                                    <Text
                                      className="text-xs mt-0.5"
                                      style={{ color: colors.textSecondary }}
                                    >
                                      {t("reports.schedule.activeMeta", {
                                        email:
                                          existing.email ??
                                          t("reports.notAvailable"),
                                        format:
                                          existing.format != null
                                            ? String(
                                                existing.format,
                                              ).toUpperCase()
                                            : t("reports.notAvailable"),
                                      })}
                                    </Text>
                                    <Text
                                      className="text-xs mt-1"
                                      style={{ color: colors.textSecondary }}
                                    >
                                      {[
                                        t("reports.filterSummary.range", {
                                          value: getScheduleRangeSummary(
                                            existing.filters,
                                            t,
                                          ),
                                        }),
                                        existing?.filters?.status
                                          ? t("reports.filterSummary.status", {
                                              value: formatStatusLabel(
                                                t,
                                                existing.filters.status,
                                              ),
                                            })
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(", ")}
                                    </Text>
                                    <View className="mt-2">
                                      <Text
                                        className="text-xs"
                                        style={{ color: colors.textSecondary }}
                                      >
                                        {t("reports.schedule.health.nextRun", {
                                          value:
                                            nextRunAt ??
                                            t("reports.notAvailable"),
                                        })}
                                      </Text>
                                      <Text
                                        className="text-xs mt-1"
                                        style={{ color: colors.textSecondary }}
                                      >
                                        {t(
                                          "reports.schedule.health.lastSuccess",
                                          {
                                            value:
                                              lastSuccessAt ??
                                              t("reports.notAvailable"),
                                          },
                                        )}
                                      </Text>
                                      <Text
                                        className="text-xs mt-1"
                                        style={{
                                          color: lastFailureAt
                                            ? colors.danger
                                            : colors.textSecondary,
                                        }}
                                      >
                                        {t(
                                          "reports.schedule.health.lastFailure",
                                          {
                                            value:
                                              lastFailureAt ??
                                              t("reports.notAvailable"),
                                          },
                                        )}
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

      <Modal
        visible={showDownloadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDownloadModal(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.dark + "80" }}
          onPress={() => setShowDownloadModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                  {`${t("reports.sections.download")} ${getFormatLabel(
                    t,
                    pendingDownloadFormat,
                  )}`}
                </Text>
                <TouchableOpacity onPress={() => setShowDownloadModal(false)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScopeSelector
                scope={reportScope}
                setScope={setReportScope}
                t={t}
                colors={colors}
                summary={filterSummary}
              />

              <TouchableOpacity
                onPress={handleConfirmDownload}
                disabled={Boolean(downloadingFormat)}
                className="py-3.5 rounded-xl items-center"
                style={{ backgroundColor: colors.primary }}
              >
                {downloadingFormat === pendingDownloadFormat ? (
                  <ActivityIndicator size="small" color={colors.light} />
                ) : (
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.light }}
                  >
                    {t("reports.downloadCta", {
                      format: getFormatLabel(t, pendingDownloadFormat),
                    })}
                  </Text>
                )}
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
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
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.dark + "80" }}
          onPress={() => setShowScheduleModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
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
              <AppTextInput
                value={scheduleEmail}
                onChangeText={setScheduleEmail}
                placeholder={t("reports.emailPlaceholder")}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={{
                  marginBottom: 16,
                }}
                inputStyle={{ fontSize: 14 }}
              />

              <ScopeSelector
                scope={scheduleScope}
                setScope={setScheduleScope}
                t={t}
                colors={colors}
                summary={scheduleSummary}
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
                      {getFormatLabel(t, fmt)}
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
          </KeyboardAvoidingView>
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
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
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
              <AppTextInput
                value={emailAddress}
                onChangeText={setEmailAddress}
                placeholder={t("reports.emailPlaceholder")}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={{
                  marginBottom: 16,
                }}
                inputStyle={{ fontSize: 14 }}
              />

              <ScopeSelector
                scope={reportScope}
                setScope={setReportScope}
                t={t}
                colors={colors}
                summary={filterSummary}
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
                      {getFormatLabel(t, fmt)}
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
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}
