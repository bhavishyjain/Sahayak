import {
  FileText,
  Download,
  FileSpreadsheet,
  FileBarChart,
  RotateCcw,
  Calendar,
  Clock,
  Mail,
  Send,
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
  TextInput,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import Card from "../../../components/Card";
import BackButtonHeader from "../../../components/BackButtonHeader";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import FilterPanel from "../../../components/FilterPanel";

import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useDownloadReport } from "../../../utils/hooks/useReports";
import getUserAuth from "../../../utils/userAuth";
import apiCall from "../../../utils/api";
import {
  REPORT_SCHEDULE_URL,
  REPORT_SCHEDULES_URL,
  REPORT_CANCEL_SCHEDULE_URL,
  REPORT_EMAIL_URL,
} from "../../../url";

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
            summary={[
              appliedFilters.status !== "all" && appliedFilters.status,
              appliedFilters.startDate && `From: ${appliedFilters.startDate}`,
              appliedFilters.endDate && `To: ${appliedFilters.endDate}`,
            ]
              .filter(Boolean)
              .join(" · ")}
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

          {/* Export Tab Content */}
          {activeTab === "export" && (
            <>
              {/* Download Reports */}
              <View className="mb-4">
                <Text
                  className="text-xs font-semibold uppercase mb-3"
                  style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
                >
                  Download
                </Text>
                <View
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {[
                    {
                      format: "pdf",
                      label: "PDF Report",
                      desc: "Professional document format",
                      icon: FileText,
                      color: "#EF4444",
                    },
                    {
                      format: "excel",
                      label: "Excel Spreadsheet",
                      desc: "Detailed data with charts",
                      icon: FileSpreadsheet,
                      color: colors.success || "#10B981",
                    },
                    {
                      format: "csv",
                      label: "CSV Data",
                      desc: "Raw data for analysis",
                      icon: FileBarChart,
                      color: colors.info || "#3B82F6",
                    },
                  ].map(
                    ({ format, label, desc, icon: Icon, color }, idx, arr) => (
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
                              {label}
                            </Text>
                            <Text
                              className="text-xs mt-0.5"
                              style={{ color: colors.textSecondary }}
                            >
                              {desc}
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
                    ),
                  )}
                </View>
              </View>

              {/* Email Report */}
              <View className="mb-4">
                <Text
                  className="text-xs font-semibold uppercase mb-3"
                  style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
                >
                  Email
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
                      backgroundColor: (colors.purple || "#8B5CF6") + "20",
                    }}
                  >
                    <Mail size={17} color={colors.purple || "#8B5CF6"} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.textPrimary }}
                    >
                      Send via Email
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      Send report to any email address
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
                    Automated Reports
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
                  {[
                    {
                      freq: "daily",
                      label: "Daily",
                      desc: "Every day at 9:00 AM",
                      icon: Clock,
                      color: colors.primary,
                    },
                    {
                      freq: "weekly",
                      label: "Weekly",
                      desc: "Every Monday at 9:00 AM",
                      icon: Calendar,
                      color: colors.info || "#3B82F6",
                    },
                    {
                      freq: "monthly",
                      label: "Monthly",
                      desc: "1st of every month",
                      icon: BarChart3,
                      color: colors.success || "#10B981",
                    },
                  ].map(
                    ({ freq, label, desc, icon: Icon, color }, idx, arr) => {
                      const existing = activeSchedules.find(
                        (s) => s.frequency === freq && s.isActive,
                      );
                      return (
                        <View key={freq}>
                          <View className="flex-row items-center px-4 py-3.5">
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
                                {label} Reports
                              </Text>
                              {existing ? (
                                <Text
                                  className="text-xs mt-0.5"
                                  style={{ color: colors.textSecondary }}
                                >
                                  {existing.email} ·{" "}
                                  {existing.format.toUpperCase()}
                                </Text>
                              ) : (
                                <Text
                                  className="text-xs mt-0.5"
                                  style={{ color: colors.textSecondary }}
                                >
                                  {desc}
                                </Text>
                              )}
                            </View>
                            {existing ? (
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
                                    color="#EF4444"
                                  />
                                ) : (
                                  <Trash2 size={16} color="#EF4444" />
                                )}
                              </TouchableOpacity>
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
                                  Set up
                                </Text>
                              </TouchableOpacity>
                            )}
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
                  Reports are generated automatically and sent to your email.
                  You can cancel schedules anytime.
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
