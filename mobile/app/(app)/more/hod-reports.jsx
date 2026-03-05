import {
  FileText,
  Download,
  FileSpreadsheet,
  FileBarChart,
  Filter,
  TrendingUp,
  BarChart3,
  RotateCcw,
} from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
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

const DEPARTMENT_OPTIONS = [
  "Road",
  "Water",
  "Electricity",
  "Waste",
  "Drainage",
  "Other",
];

const STATUS_OPTIONS = [
  "pending",
  "assigned",
  "in-progress",
  "pending-approval",
  "needs-rework",
  "resolved",
  "cancelled",
];

const DEPARTMENT_LABEL_KEYS = {
  Road: "complaints.departments.road",
  Water: "complaints.departments.water",
  Electricity: "complaints.departments.electricity",
  Waste: "complaints.departments.waste",
  Drainage: "complaints.departments.drainage",
  Other: "complaints.departments.other",
};

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

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState({
    department: "all",
    status: "all",
    startDate: "",
    endDate: "",
  });
  const [draftFilters, setDraftFilters] = useState(appliedFilters);

  const normalizedFilters = useMemo(
    () => normalizeFilters(appliedFilters),
    [appliedFilters],
  );

  const {
    data: stats,
    isFetching: loadingStats,
    refetch: loadStats,
  } = useReportStats(normalizedFilters, { enabled: false, staleTime: 60 * 1000 });

  const { download } = useDownloadReport();

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      appliedFilters.department !== "all" ||
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
      department: "all",
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
        text2: t("reports.reportReady", { format: format.toUpperCase() }),
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2:
          error?.response?.data?.message || t("reports.generateFailed"),
      });
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("reports.title")} colors={colors} />

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <TouchableOpacity
          onPress={() => loadStats()}
          activeOpacity={0.7}
          disabled={loadingStats}
        >
          <Card style={{ margin: 0, marginTop: 16, marginBottom: 16, flex: 0 }}>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.info + "20" }}
                >
                  <BarChart3 size={20} color={colors.info || "#3B82F6"} />
                </View>
                <Text
                  className="text-base font-semibold ml-3"
                  style={{ color: colors.textPrimary }}
                >
                  {t("reports.statistics")}
                </Text>
              </View>
              {loadingStats ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <TrendingUp size={20} color={colors.success || "#10B981"} />
              )}
            </View>

            {stats ? (
              <>
                <View
                  className="h-[1px] mb-3"
                  style={{ backgroundColor: colors.border }}
                />

                <View className="space-y-2">
                  <View className="flex-row justify-between">
                    <Text
                      className="text-sm"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("reports.totalComplaints")}
                    </Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.textPrimary }}
                    >
                      {stats.total || 0}
                    </Text>
                  </View>

                  <View className="flex-row justify-between">
                    <Text
                      className="text-sm"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("reports.resolved")}
                    </Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.success || "#10B981" }}
                    >
                      {stats.byStatus?.resolved || 0}
                    </Text>
                  </View>

                  <View className="flex-row justify-between">
                    <Text
                      className="text-sm"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("reports.pending")}
                    </Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.warning || "#F59E0B" }}
                    >
                      {stats.byStatus?.pending || 0}
                    </Text>
                  </View>

                  <View className="flex-row justify-between">
                    <Text
                      className="text-sm"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("reports.avgResolutionTime")}
                    </Text>
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.textPrimary }}
                    >
                      {stats.avgResolutionTime || 0}h
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              !loadingStats && (
                <Text
                  className="text-sm text-center py-4"
                  style={{ color: colors.textSecondary }}
                >
                  {t("reports.tapToLoad")}
                </Text>
              )
            )}
          </Card>
        </TouchableOpacity>

        <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
          <View className="flex-row items-center mb-3">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.primary + "20" }}
            >
              <FileText size={20} color={colors.primary} />
            </View>
            <Text
              className="text-base font-semibold ml-3"
              style={{ color: colors.textPrimary }}
            >
              {t("reports.export")}
            </Text>
          </View>

          <View
            className="h-[1px] mb-3"
            style={{ backgroundColor: colors.border }}
          />

          <Text className="text-sm mb-3" style={{ color: colors.textSecondary }}>
            {t("reports.exportDescription")}
          </Text>

          <View className="space-y-2">
            <TouchableOpacity
              onPress={() => downloadReport("pdf")}
              disabled={Boolean(downloadingFormat)}
              activeOpacity={0.7}
              className="rounded-lg p-3 flex-row items-center justify-between"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <View className="flex-row items-center flex-1">
                <View
                  className="w-9 h-9 rounded-lg items-center justify-center"
                  style={{ backgroundColor: "#EF444420" }}
                >
                  <FileText size={18} color="#EF4444" />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("reports.pdfReport")}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("reports.pdfDescription")}
                  </Text>
                </View>
              </View>
              {downloadingFormat === "pdf" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Download size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => downloadReport("excel")}
              disabled={Boolean(downloadingFormat)}
              activeOpacity={0.7}
              className="rounded-lg p-3 flex-row items-center justify-between mt-2"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <View className="flex-row items-center flex-1">
                <View
                  className="w-9 h-9 rounded-lg items-center justify-center"
                  style={{ backgroundColor: colors.success + "20" }}
                >
                  <FileSpreadsheet
                    size={18}
                    color={colors.success || "#10B981"}
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("reports.excelReport")}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("reports.excelDescription")}
                  </Text>
                </View>
              </View>
              {downloadingFormat === "excel" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Download size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => downloadReport("csv")}
              disabled={Boolean(downloadingFormat)}
              activeOpacity={0.7}
              className="rounded-lg p-3 flex-row items-center justify-between mt-2"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <View className="flex-row items-center flex-1">
                <View
                  className="w-9 h-9 rounded-lg items-center justify-center"
                  style={{ backgroundColor: colors.info + "20" }}
                >
                  <FileBarChart size={18} color={colors.info || "#3B82F6"} />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("reports.csvReport")}
                  </Text>
                  <Text
                    className="text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("reports.csvDescription")}
                  </Text>
                </View>
              </View>
              {downloadingFormat === "csv" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Download size={18} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          <View
            className="h-[1px] my-3"
            style={{ backgroundColor: colors.border }}
          />

          <TouchableOpacity
            onPress={() => setShowFilterModal(true)}
            className="flex-row items-center justify-center py-2"
          >
            <Filter size={16} color={colors.primary} />
            <Text
              className="text-sm font-medium ml-2"
              style={{ color: colors.primary }}
            >
              {hasActiveFilters ? t("reports.editFilters") : t("reports.addFilters")}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

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
            <Text
              className="text-lg font-bold mb-4"
              style={{ color: colors.textPrimary }}
            >
              {t("reports.filters")}
            </Text>

            <Text
              className="text-xs mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("reports.filterDepartment")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row">
                {["all", ...DEPARTMENT_OPTIONS].map((department) => {
                  const selected = draftFilters.department === department;
                  return (
                    <TouchableOpacity
                      key={department}
                      onPress={() =>
                        setDraftFilters((prev) => ({ ...prev, department }))
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
                        className="text-xs font-semibold"
                        style={{
                          color: selected ? colors.primary : colors.textPrimary,
                        }}
                      >
                        {department === "all"
                          ? t("common.all")
                          : t(DEPARTMENT_LABEL_KEYS[department] || department)}
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
              {t("reports.filterStatus")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
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
                        {status === "all" ? t("common.all") : formatStatusLabel(t, status)}
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
    </View>
  );
}
