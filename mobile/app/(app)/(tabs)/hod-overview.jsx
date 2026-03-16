import {
  BarChart3,
  PieChart,
  Users,
  Clock,
  AlertTriangle,
  Award,
  ThumbsUp,
  X,
  Calculator,
  CheckCircle,
  Timer,
  Target,
  ChevronRight,
  Star,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import NotificationBellButton from "../../../components/NotificationBellButton";
import {
  getPriorityColor,
  getStatusColor,
} from "../../../data/complaintStatus";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useHodDashboardSummary } from "../../../utils/hooks/useDashboardData";
import getUserAuth from "../../../utils/userAuth";

export default function HodOverview() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const insets = useSafeAreaInsets();

  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [user, setUser] = useState(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greetings.morning");
    if (hour < 17) return t("greetings.afternoon");
    if (hour < 21) return t("greetings.evening");
    return t("greetings.night");
  };

  const {
    data: stats,
    isLoading: loading,
    isRefetching: refreshing,
    refetch,
    error,
  } = useHodDashboardSummary();

  useEffect(() => {
    getUserAuth().then((userData) => {
      if (userData) setUser(userData);
    });
  }, []);

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("toast.error.failed"),
      text2: t("toast.error.loadFailed"),
    });
  }, [error, t]);

  // Derived values
  const completionRate =
    stats?.total > 0
      ? Math.round(((stats.resolved + stats.cancelled) / stats.total) * 100)
      : 0;
  const activeWorkRate =
    stats?.total > 0
      ? Math.round(((stats.assigned + stats.inProgress) / stats.total) * 100)
      : 0;
  const pendingRate =
    stats?.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0;
  const responseScore = stats?.avgResponseTime
    ? Math.max(0, Math.round(100 - stats.avgResponseTime * 2))
    : 50;
  const pendingScore =
    stats?.total > 0
      ? Math.round(100 - (stats.pending / stats.total) * 30)
      : 100;
  const pendingColor = getStatusColor("pending", colors) ?? colors.warning;
  const assignedColor = getStatusColor("assigned", colors) ?? colors.info;
  const inProgressColor =
    getStatusColor("in-progress", colors) ?? colors.info;
  const pendingApprovalColor =
    getStatusColor("pending-approval", colors) ?? colors.warning;
  const resolvedColor = getStatusColor("resolved", colors) ?? colors.success;
  const cancelledColor = getStatusColor("cancelled", colors) ?? colors.danger;
  const highPriorityColor = getPriorityColor("High", colors) ?? colors.danger;
  const mediumPriorityColor =
    getPriorityColor("Medium", colors) ?? colors.warning;
  const lowPriorityColor = getPriorityColor("Low", colors) ?? colors.success;
  const perfColor =
    (stats?.performanceScore ?? 0) >= 80
      ? colors.success
      : (stats?.performanceScore ?? 0) >= 60
        ? colors.warning
        : colors.danger;
  const formulaLines = t("hod.dashboard.performance.formulaText")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const SectionLabel = ({ label }) => (
    <Text
      className="text-xs font-semibold tracking-widest uppercase mb-2 mt-1"
      style={{ color: colors.textSecondary }}
    >
      {label}
    </Text>
  );

  const Divider = () => (
    <View
      className="h-[1px] ml-14"
      style={{ backgroundColor: colors.border }}
    />
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      {/* Header */}
      <View className="px-4 pt-12 pb-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {getGreeting()}
          </Text>
          <NotificationBellButton />
        </View>
        <Text
          className="text-3xl font-bold mt-1"
          style={{ color: colors.textPrimary }}
        >
          {user?.fullName ?? t("hod.dashboard.analyticsTitle")}
        </Text>
        <View className="flex-row items-center mt-2">
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: colors.primary + "20" }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: colors.primary }}
            >
              {user?.department ??
                stats?.department ??
                t("hod.dashboard.department")}{" "}
              {t("hod.dashboard.department")}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refetch()}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {stats ? (
            <>
              {/* ─── COMPLAINTS ──────────────────────────── */}
              <SectionLabel label={t("hod.dashboard.complaints.total")} />
              <View
                className="rounded-2xl mb-5 overflow-hidden"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                {/* Total header */}
                <View className="flex-row items-center justify-between px-4 py-3">
                  <View className="flex-row items-center">
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center"
                      style={{ backgroundColor: colors.primary + "18" }}
                    >
                      <BarChart3 size={20} color={colors.primary} />
                    </View>
                    <Text
                      className="text-sm font-medium ml-3"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.dashboard.complaints.total")}
                    </Text>
                  </View>
                  <Text
                    className="text-3xl font-bold"
                    style={{ color: colors.primary }}
                  >
                    {stats.total ?? 0}
                  </Text>
                </View>

                {/* Pending / Assigned / In-Progress grid */}
                <View
                  className="h-[1px]"
                  style={{ backgroundColor: colors.border }}
                />
                <View className="flex-row py-4">
                  {[
                    {
                      label: t("hod.dashboard.complaints.pending"),
                      value: stats.pending ?? 0,
                      color: pendingColor,
                    },
                    {
                      label: t("hod.dashboard.complaints.assigned"),
                      value: stats.assigned ?? 0,
                      color: assignedColor,
                    },
                    {
                      label: t("hod.dashboard.complaints.inProgress"),
                      value: stats.inProgress ?? 0,
                      color: inProgressColor,
                    },
                  ].map((col, i, arr) => (
                    <View
                      key={i}
                      className="flex-1 items-center"
                      style={
                        i < arr.length - 1
                          ? {
                              borderRightWidth: 1,
                              borderRightColor: colors.border,
                            }
                          : {}
                      }
                    >
                      <Text
                        className="text-2xl font-bold"
                        style={{ color: col.color }}
                      >
                        {col.value}
                      </Text>
                      <Text
                        className="text-xs mt-1 text-center px-2"
                        style={{ color: colors.textSecondary }}
                      >
                        {col.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Pending Approval (if any) */}
                {stats.pendingApproval > 0 && (
                  <>
                    <View
                      className="h-[1px] ml-14"
                      style={{ backgroundColor: colors.border }}
                    />
                    <View className="flex-row items-center py-3 px-4">
                      <View className="w-10 h-10 items-center justify-center">
                        <View
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: pendingApprovalColor }}
                        />
                      </View>
                      <Text
                        className="flex-1 text-sm ml-3"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("hod.dashboard.awaitingApproval")}
                      </Text>
                      <Text
                        className="text-base font-semibold"
                        style={{ color: pendingApprovalColor }}
                      >
                        {stats.pendingApproval}
                      </Text>
                    </View>
                  </>
                )}

                {/* Resolved / Cancelled */}
                <View
                  className="h-[1px]"
                  style={{ backgroundColor: colors.border }}
                />
                <View className="flex-row py-4">
                  <View
                    className="flex-1 items-center"
                    style={{
                      borderRightWidth: 1,
                      borderRightColor: colors.border,
                    }}
                  >
                    <Text
                      className="text-2xl font-bold"
                      style={{ color: resolvedColor }}
                    >
                      {stats.resolved ?? 0}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.dashboard.complaints.resolved")}
                    </Text>
                  </View>
                  <View className="flex-1 items-center">
                    <Text
                      className="text-2xl font-bold"
                      style={{ color: cancelledColor }}
                    >
                      {stats.cancelled ?? 0}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: cancelledColor }}
                    >
                      {t("hod.dashboard.complaints.cancelled")}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ─── PRIORITY ────────────────────────────── */}
              <SectionLabel label={t("hod.dashboard.priorityDistribution")} />
              <View
                className="rounded-2xl mb-5 overflow-hidden"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                <View className="flex-row items-center py-3 px-4">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: colors.warning + "18",
                    }}
                  >
                    <AlertTriangle size={20} color={colors.warning} />
                  </View>
                  <Text
                    className="flex-1 text-sm font-medium ml-3"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("hod.dashboard.priorityDistribution")}
                  </Text>
                </View>

                <View
                  className="h-[1px]"
                  style={{ backgroundColor: colors.border }}
                />
                <View className="flex-row justify-between px-4 py-4">
                  {[
                    {
                      label: t("complaints.priority.high"),
                      value: stats.highPriority ?? 0,
                      color: highPriorityColor,
                    },
                    {
                      label: t("complaints.priority.medium"),
                      value: stats.mediumPriority ?? 0,
                      color: mediumPriorityColor,
                    },
                    {
                      label: t("complaints.priority.low"),
                      value: stats.lowPriority ?? 0,
                      color: lowPriorityColor,
                    },
                  ].map((p, i) => (
                    <View key={i} className="flex-1 items-center">
                      <View
                        className="w-14 h-14 rounded-full items-center justify-center mb-2"
                        style={{ backgroundColor: p.color + "20" }}
                      >
                        <Text
                          className="text-xl font-bold"
                          style={{ color: p.color }}
                        >
                          {p.value}
                        </Text>
                      </View>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        {p.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* ─── EFFICIENCY ──────────────────────────── */}
              <SectionLabel label={t("hod.dashboard.departmentEfficiency")} />
              <View
                className="rounded-2xl mb-5 overflow-hidden"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                <View className="flex-row items-center py-3 px-4">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: colors.info + "18",
                    }}
                  >
                    <PieChart size={20} color={colors.info} />
                  </View>
                  <Text
                    className="flex-1 text-sm font-medium ml-3"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("hod.dashboard.departmentEfficiency")}
                  </Text>
                </View>

                {[
                  {
                    label: t("hod.dashboard.performance.completionRate"),
                    value: completionRate,
                    color: colors.success,
                  },
                  {
                    label: t("hod.dashboard.activeWorkRate"),
                    value: activeWorkRate,
                    color: colors.info,
                  },
                  {
                    label: t("hod.dashboard.performance.pendingRate"),
                    value: pendingRate,
                    color: colors.warning,
                  },
                ].map((metric, i) => (
                  <View key={i}>
                    <Divider />
                    <View className="flex-row items-center px-4 py-3">
                      <View className="w-10 h-10 items-center justify-center">
                        <View
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: metric.color }}
                        />
                      </View>
                      <View className="flex-1 ml-3">
                        <View className="flex-row justify-between mb-1.5">
                          <Text
                            className="text-sm"
                            style={{ color: colors.textSecondary }}
                          >
                            {metric.label}
                          </Text>
                          <Text
                            className="text-sm font-bold"
                            style={{ color: metric.color }}
                          >
                            {metric.value}%
                          </Text>
                        </View>
                        <View
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ backgroundColor: colors.border }}
                        >
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${metric.value}%`,
                              backgroundColor: metric.color,
                            }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* ─── TEAM & ENGAGEMENT ───────────────────── */}
              <SectionLabel label={t("hod.dashboard.workers.teamManagement")} />
              <View
                className="rounded-2xl mb-5 overflow-hidden"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                {/* Active Workers */}
                <View className="flex-row items-center py-3 px-4">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: colors.info + "18",
                    }}
                  >
                    <Users size={20} color={colors.info} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.textPrimary }}
                    >
                      {t("hod.dashboard.workers.active")}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {stats.totalWorkers ?? 0}
                      {t("hod.dashboard.workers.totalWorkers")}
                    </Text>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.info }}
                  >
                    {stats.activeWorkers ?? 0}
                  </Text>
                </View>

                {/* Avg Response Time */}
                <Divider />
                <View className="flex-row items-center py-3 px-4">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: colors.info + "18",
                    }}
                  >
                    <Clock size={20} color={colors.info} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.textPrimary }}
                    >
                      {t("hod.dashboard.workers.avgResponse")}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {stats.avgResponseTime
                        ? t("hod.dashboard.hoursToAssign")
                        : t("hod.dashboard.noData")}
                    </Text>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.info }}
                  >
                    {stats.avgResponseTime ?? t("hod.dashboard.noData")}
                  </Text>
                </View>

                {/* Total Upvotes */}
                <Divider />
                <View className="flex-row items-center py-3 px-4">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{ backgroundColor: colors.primary + "18" }}
                  >
                    <ThumbsUp size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.textPrimary }}
                    >
                      {t("hod.dashboard.engagement.totalUpvotes")}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {stats.total > 0
                        ? `${Math.round((stats.totalUpvotes ?? 0) / stats.total)} ${t("hod.dashboard.engagement.avgPerComplaint")}`
                        : t("hod.dashboard.noData")}
                    </Text>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.primary }}
                  >
                    {stats.totalUpvotes ?? 0}
                  </Text>
                </View>

                {/* Citizen Satisfaction (if available) */}
                {stats.avgFeedbackRating && (
                  <>
                    <Divider />
                    <View className="flex-row items-center py-3 px-4">
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center"
                        style={{
                          backgroundColor: colors.warning + "18",
                        }}
                      >
                        <Star
                          size={20}
                          color={colors.warning}
                          fill={colors.warning}
                        />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text
                          className="text-sm font-medium"
                          style={{ color: colors.textPrimary }}
                        >
                          {t("hod.dashboard.engagement.citizenSatisfaction")}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={11}
                              color={colors.warning}
                              fill={
                                s <= Math.round(stats.avgFeedbackRating)
                                  ? colors.warning
                                  : "transparent"
                              }
                              style={{ marginRight: 2 }}
                            />
                          ))}
                        </View>
                      </View>
                      <Text
                        className="text-xl font-bold"
                        style={{ color: colors.warning }}
                      >
                        {stats.avgFeedbackRating}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* ─── PERFORMANCE SCORE ───────────────────── */}
              <SectionLabel
                label={t("hod.dashboard.performance.overallPerformance")}
              />
              <TouchableOpacity
                onPress={() => setShowPerformanceModal(true)}
                activeOpacity={0.7}
                className="rounded-2xl mb-8"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                <View className="flex-row items-center py-3 px-4">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: colors.success + "18",
                    }}
                  >
                    <Award size={20} color={colors.success} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.textPrimary }}
                    >
                      {t("hod.dashboard.performance.overallPerformance")}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.dashboard.performance.tapToSeeDetails")}
                    </Text>
                  </View>
                  <Text
                    className="text-2xl font-bold mr-2"
                    style={{ color: perfColor }}
                  >
                    {stats.performanceScore ?? 0}%
                  </Text>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </View>
                <View
                  className="h-[1px] ml-14"
                  style={{ backgroundColor: colors.border }}
                />
                <View className="px-4 py-3">
                  <View
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: colors.border }}
                  >
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${stats.performanceScore ?? 0}%`,
                        backgroundColor: perfColor,
                      }}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <View
              className="rounded-2xl mt-4 py-12 items-center justify-center"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.backgroundSecondary,
              }}
            >
              <BarChart3 size={32} color={colors.textSecondary} />
              <Text
                className="text-sm mt-3 font-medium"
                style={{ color: colors.textSecondary }}
              >
                {t("hod.dashboard.noAnalyticsData")}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ─── PERFORMANCE MODAL ───────────────────── */}
      <Modal
        visible={showPerformanceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPerformanceModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setShowPerformanceModal(false)}
        >
          <Pressable
            className="w-full rounded-t-3xl"
            style={{ backgroundColor: colors.backgroundPrimary }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <View className="items-center pt-3 pb-1">
              <View
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: colors.border }}
              />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-3 pb-4">
              <View className="flex-row items-center gap-3">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: perfColor + "20" }}
                >
                  <Award size={20} color={perfColor} />
                </View>
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {t("hod.dashboard.performance.calculationTitle")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPerformanceModal(false)}
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.backgroundSecondary }}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: Math.max(insets.bottom + 20, 32),
              }}
            >
              {/* Score Banner */}
              <View className="mx-5 mb-4 rounded-2xl overflow-hidden">
                <View
                  className="px-5 py-4"
                  style={{ backgroundColor: perfColor + "18" }}
                >
                  <Text
                    className="text-xs font-semibold uppercase tracking-widest mb-1"
                    style={{ color: perfColor }}
                  >
                    {t("hod.dashboard.performance.currentScore")}
                  </Text>
                  <View className="flex-row items-end gap-2">
                    <Text
                      className="text-5xl font-bold"
                      style={{ color: perfColor }}
                    >
                      {stats?.performanceScore ?? 0}
                    </Text>
                    <Text
                      className="text-2xl font-bold mb-1"
                      style={{ color: perfColor + "80" }}
                    >
                      %
                    </Text>
                  </View>
                  {/* Overall bar */}
                  <View
                    className="h-2 rounded-full mt-3 overflow-hidden"
                    style={{ backgroundColor: perfColor + "30" }}
                  >
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${stats?.performanceScore ?? 0}%`,
                        backgroundColor: perfColor,
                      }}
                    />
                  </View>
                </View>
              </View>

              {/* Formula */}
              <View className="mx-5 mb-4">
                <View className="flex-row items-center mb-2">
                  <Calculator size={14} color={colors.textSecondary} />
                  <Text
                    className="text-xs font-semibold uppercase tracking-widest ml-2"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("hod.dashboard.performance.calculationFormula")}
                  </Text>
                </View>
                <View
                  className="rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {formulaLines.length > 0 ? (
                    formulaLines.map((line, index) => (
                      <Text
                        key={index}
                        className={
                          index === 0 ? "text-sm font-semibold" : "text-sm"
                        }
                        style={{
                          color:
                            index === 0
                              ? colors.textPrimary
                              : colors.textSecondary,
                          marginTop: index === 0 ? 0 : 4,
                          lineHeight: 22,
                        }}
                      >
                        {line}
                      </Text>
                    ))
                  ) : (
                    <Text
                      className="text-sm"
                      style={{ color: colors.textSecondary, lineHeight: 22 }}
                    >
                      {t("hod.dashboard.performance.formulaText")}
                    </Text>
                  )}
                </View>
              </View>

              {/* Components */}
              <View className="mx-5 mb-4">
                <View className="flex-row items-center mb-2">
                  <Target size={14} color={colors.textSecondary} />
                  <Text
                    className="text-xs font-semibold uppercase tracking-widest ml-2"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("hod.dashboard.performance.componentsTitle")}
                  </Text>
                </View>

                <View
                  className="rounded-2xl overflow-hidden"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                  }}
                >
                  {[
                    {
                      Icon: CheckCircle,
                      color: colors.success,
                      title: t("hod.dashboard.performance.completionRateTitle"),
                      weight: t("hod.dashboard.performance.weight50"),
                      value: stats
                        ? Math.round(
                            ((stats.resolved + stats.cancelled) / stats.total) *
                              100,
                          )
                        : 0,
                      barWidth:
                        stats?.total > 0
                          ? `${Math.round(((stats.resolved + stats.cancelled) / stats.total) * 100)}%`
                          : "0%",
                      note: stats
                        ? t("hod.dashboard.performance.notes.completion", {
                            completed: stats.resolved + stats.cancelled,
                            total: stats.total,
                          })
                        : t("hod.dashboard.performance.notes.loading"),
                    },
                    {
                      Icon: Timer,
                      color: colors.warning,
                      title: t("hod.dashboard.performance.responseTimeTitle"),
                      weight: t("hod.dashboard.performance.weight30"),
                      value: responseScore,
                      barWidth: `${responseScore}%`,
                      note: stats?.avgResponseTime
                        ? t("hod.dashboard.performance.notes.response", {
                            hours: stats.avgResponseTime,
                          })
                        : t("hod.dashboard.performance.notes.noDataYet"),
                    },
                    {
                      Icon: AlertTriangle,
                      color: colors.danger,
                      title: t("hod.dashboard.performance.pendingStatusTitle"),
                      weight: t("hod.dashboard.performance.weight20"),
                      value: pendingScore,
                      barWidth: `${pendingScore}%`,
                      note: stats
                        ? t("hod.dashboard.performance.notes.pending", {
                            pending: stats.pending,
                            percent: Math.round(
                              (stats.pending / stats.total) * 100,
                            ),
                          })
                        : t("hod.dashboard.performance.notes.loading"),
                    },
                  ].map(
                    (
                      { Icon, color, title, weight, value, barWidth, note },
                      i,
                      arr,
                    ) => (
                      <View key={i}>
                        {i > 0 && (
                          <View
                            className="h-[1px] ml-14"
                            style={{ backgroundColor: colors.border }}
                          />
                        )}
                        <View className="px-4 pt-3 pb-4">
                          {/* Row: icon + title + value */}
                          <View className="flex-row items-center mb-3">
                            <View
                              className="w-9 h-9 rounded-xl items-center justify-center"
                              style={{ backgroundColor: color + "20" }}
                            >
                              <Icon size={17} color={color} />
                            </View>
                            <View className="flex-1 ml-3">
                              <Text
                                className="text-sm font-semibold"
                                style={{ color: colors.textPrimary }}
                              >
                                {title}
                              </Text>
                              <Text
                                className="text-xs mt-0.5"
                                style={{ color: colors.textSecondary }}
                              >
                                {weight}
                              </Text>
                            </View>
                            <Text
                              className="text-2xl font-bold"
                              style={{ color }}
                            >
                              {value}%
                            </Text>
                          </View>
                          {/* Progress bar */}
                          <View
                            className="h-2 rounded-full overflow-hidden"
                            style={{ backgroundColor: color + "20" }}
                          >
                            <View
                              className="h-full rounded-full"
                              style={{
                                width: barWidth,
                                backgroundColor: color,
                              }}
                            />
                          </View>
                          {/* Note */}
                          <Text
                            className="text-xs mt-2"
                            style={{ color: colors.textSecondary }}
                          >
                            {note}
                          </Text>
                        </View>
                      </View>
                    ),
                  )}
                </View>
              </View>

              {/* Close Button */}
              <View className="mx-5">
                <Pressable
                  className="rounded-2xl py-4"
                  style={{ backgroundColor: colors.primary }}
                  onPress={() => setShowPerformanceModal(false)}
                >
                  <Text
                    className="text-center font-semibold text-base"
                    style={{ color: colors.light }}
                  >
                    {t("hod.dashboard.performance.gotIt")}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
