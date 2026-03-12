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
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import getUserAuth from "../../../utils/userAuth";
import { HOD_OVERVIEW_URL } from "../../../url";

export default function HodOverview() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [user, setUser] = useState(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greetings.morning");
    if (hour < 17) return t("greetings.afternoon");
    if (hour < 21) return t("greetings.evening");
    return t("greetings.night");
  };

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await apiCall({ method: "GET", url: HOD_OVERVIEW_URL });
      setStats(res?.data?.stats || null);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2: e?.response?.data?.message || t("toast.error.loadFailed"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
    getUserAuth().then((userData) => {
      if (userData) setUser(userData);
    });
  }, []);

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
      ? Math.round(100 - (stats.pending / stats.total) * 30) || 100
      : 100;
  const perfColor =
    (stats?.performanceScore || 0) >= 80
      ? colors.success || "#10B981"
      : (stats?.performanceScore || 0) >= 60
        ? colors.warning || "#F59E0B"
        : "#EF4444";

  const statusRows = stats
    ? [
        {
          label: t("hod.dashboard.complaints.pending"),
          value: stats.pending || 0,
          color: colors.warning || "#F59E0B",
        },
        {
          label: t("hod.dashboard.complaints.assigned"),
          value: stats.assigned || 0,
          color: colors.info || "#3B82F6",
        },
        {
          label: t("hod.dashboard.complaints.inProgress"),
          value: stats.inProgress || 0,
          color: colors.purple || "#8B5CF6",
        },
        ...(stats.pendingApproval > 0
          ? [
              {
                label:
                  t("hod.dashboard.awaitingApproval") || "Awaiting Approval",
                value: stats.pendingApproval,
                color: "#F97316",
              },
            ]
          : []),
        {
          label: t("hod.dashboard.complaints.resolved"),
          value: stats.resolved || 0,
          color: colors.success || "#10B981",
        },
        {
          label: t("hod.dashboard.complaints.cancelled"),
          value: stats.cancelled || 0,
          color: colors.textSecondary,
        },
      ]
    : [];

  const priorityRows = [
    {
      label: t("complaints.priority.high"),
      value: stats?.highPriority || 0,
      color: "#EF4444",
    },
    {
      label: t("complaints.priority.medium"),
      value: stats?.mediumPriority || 0,
      color: colors.warning || "#F59E0B",
    },
    {
      label: t("complaints.priority.low"),
      value: stats?.lowPriority || 0,
      color: colors.success || "#10B981",
    },
  ];

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
        <Text className="text-sm" style={{ color: colors.textSecondary }}>
          {getGreeting()}
        </Text>
        <Text
          className="text-3xl font-bold mt-1"
          style={{ color: colors.textPrimary }}
        >
          {user?.fullName || t("hod.dashboard.analyticsTitle")}
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
              {user?.department || stats?.department || ""} {t("worker.dashboard.department")}
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
              onRefresh={() => load(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {stats ? (
            <>
              {/* ─── COMPLAINTS ──────────────────────────── */}
              <SectionLabel
                label={t("hod.dashboard.complaints.total") || "Complaints"}
              />
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
                      {t("hod.dashboard.complaints.total") ||
                        "Total Complaints"}
                    </Text>
                  </View>
                  <Text
                    className="text-3xl font-bold"
                    style={{ color: colors.primary }}
                  >
                    {stats.total || 0}
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
                      value: stats.pending || 0,
                      color: colors.warning || "#F59E0B",
                    },
                    {
                      label: t("hod.dashboard.complaints.assigned"),
                      value: stats.assigned || 0,
                      color: colors.info || "#3B82F6",
                    },
                    {
                      label: t("hod.dashboard.complaints.inProgress"),
                      value: stats.inProgress || 0,
                      color: colors.purple || "#8B5CF6",
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
                          style={{ backgroundColor: "#F97316" }}
                        />
                      </View>
                      <Text
                        className="flex-1 text-sm ml-3"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("hod.dashboard.awaitingApproval") ||
                          "Awaiting Approval"}
                      </Text>
                      <Text
                        className="text-base font-semibold"
                        style={{ color: "#F97316" }}
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
                      style={{ color: colors.success || "#10B981" }}
                    >
                      {stats.resolved || 0}
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
                      style={{ color: colors.textSecondary }}
                    >
                      {stats.cancelled || 0}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.dashboard.complaints.cancelled")}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ─── PRIORITY ────────────────────────────── */}
              <SectionLabel
                label={t("hod.dashboard.priorityDistribution") || "Priority"}
              />
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
                      backgroundColor: (colors.warning || "#F59E0B") + "18",
                    }}
                  >
                    <AlertTriangle
                      size={20}
                      color={colors.warning || "#F59E0B"}
                    />
                  </View>
                  <Text
                    className="flex-1 text-sm font-medium ml-3"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("hod.dashboard.priorityDistribution") ||
                      "Priority Distribution"}
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
                      value: stats.highPriority || 0,
                      color: "#EF4444",
                    },
                    {
                      label: t("complaints.priority.medium"),
                      value: stats.mediumPriority || 0,
                      color: colors.warning || "#F59E0B",
                    },
                    {
                      label: t("complaints.priority.low"),
                      value: stats.lowPriority || 0,
                      color: colors.success || "#10B981",
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
              <SectionLabel
                label={t("hod.dashboard.departmentEfficiency") || "Efficiency"}
              />
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
                      backgroundColor: (colors.info || "#3B82F6") + "18",
                    }}
                  >
                    <PieChart size={20} color={colors.info || "#3B82F6"} />
                  </View>
                  <Text
                    className="flex-1 text-sm font-medium ml-3"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("hod.dashboard.departmentEfficiency") ||
                      "Department Efficiency"}
                  </Text>
                </View>

                {[
                  {
                    label:
                      t("hod.dashboard.performance.completionRate") ||
                      "Completion Rate",
                    value: completionRate,
                    color: colors.success || "#10B981",
                  },
                  {
                    label:
                      t("hod.dashboard.activeWorkRate") || "Active Work Rate",
                    value: activeWorkRate,
                    color: colors.info || "#3B82F6",
                  },
                  {
                    label:
                      t("hod.dashboard.performance.pendingRate") ||
                      "Pending Rate",
                    value: pendingRate,
                    color: colors.warning || "#F59E0B",
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
              <SectionLabel
                label={
                  t("hod.dashboard.workers.teamenagment") || "Team & Engagement"
                }
              />
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
                      backgroundColor: (colors.info || "#3B82F6") + "18",
                    }}
                  >
                    <Users size={20} color={colors.info || "#3B82F6"} />
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
                      {stats.totalWorkers || 0}
                      {t("hod.dashboard.workers.totalWorkers")}
                    </Text>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.info || "#3B82F6" }}
                  >
                    {stats.activeWorkers || 0}
                  </Text>
                </View>

                {/* Avg Response Time */}
                <Divider />
                <View className="flex-row items-center py-3 px-4">
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: (colors.purple || "#8B5CF6") + "18",
                    }}
                  >
                    <Clock size={20} color={colors.purple || "#8B5CF6"} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.textPrimary }}
                    >
                      {t("hod.dashboard.workers.avgResponse") ||
                        "Avg Response Time"}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {stats.avgResponseTime
                        ? t("hod.dashboard.hoursToAssign") || "hours to assign"
                        : t("hod.dashboard.noData") || "No data yet"}
                    </Text>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.purple || "#8B5CF6" }}
                  >
                    {stats.avgResponseTime || "—"}
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
                      {t("hod.dashboard.engagement.totalUpvotes") ||
                        "Total Upvotes"}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {stats.total > 0
                        ? `${Math.round((stats.totalUpvotes || 0) / stats.total)} ${t("hod.dashboard.engagement.avgPerComplaint") || "avg per complaint"}`
                        : t("hod.dashboard.noData") || "No data"}
                    </Text>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.primary }}
                  >
                    {stats.totalUpvotes || 0}
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
                          backgroundColor: (colors.warning || "#F59E0B") + "18",
                        }}
                      >
                        <Star
                          size={20}
                          color={colors.warning || "#F59E0B"}
                          fill={colors.warning || "#F59E0B"}
                        />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text
                          className="text-sm font-medium"
                          style={{ color: colors.textPrimary }}
                        >
                          Citizen Satisfaction
                        </Text>
                        <View className="flex-row items-center mt-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={11}
                              color={colors.warning || "#F59E0B"}
                              fill={
                                s <= Math.round(stats.avgFeedbackRating)
                                  ? colors.warning || "#F59E0B"
                                  : "transparent"
                              }
                              style={{ marginRight: 2 }}
                            />
                          ))}
                        </View>
                      </View>
                      <Text
                        className="text-xl font-bold"
                        style={{ color: colors.warning || "#F59E0B" }}
                      >
                        {stats.avgFeedbackRating}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {/* ─── PERFORMANCE SCORE ───────────────────── */}
              <SectionLabel
                label={
                  t("hod.dashboard.performance.overallPerformance") ||
                  "Performance"
                }
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
                      backgroundColor: (colors.success || "#10B981") + "18",
                    }}
                  >
                    <Award size={20} color={colors.success || "#10B981"} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.textPrimary }}
                    >
                      {t("hod.dashboard.performance.overallPerformance") ||
                        "Overall Performance"}
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.dashboard.performance.tapToSeeDetails") ||
                        "Tap to see breakdown"}
                    </Text>
                  </View>
                  <Text
                    className="text-2xl font-bold mr-2"
                    style={{ color: perfColor }}
                  >
                    {stats.performanceScore || 0}%
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
                        width: `${stats.performanceScore || 0}%`,
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
                {t("hod.dashboard.noAnalyticsData") ||
                  "No analytics data available"}
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
                  {t("hod.dashboard.performance.calculationTitle") ||
                    "Performance Calculation"}
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
              contentContainerStyle={{ paddingBottom: 32 }}
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
                    {t("hod.dashboard.performance.currentScore") ||
                      "Current Performance Score"}
                  </Text>
                  <View className="flex-row items-end gap-2">
                    <Text
                      className="text-5xl font-bold"
                      style={{ color: perfColor }}
                    >
                      {stats?.performanceScore || 0}
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
                        width: `${stats?.performanceScore || 0}%`,
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
                    {t("hod.dashboard.performance.calculationFormula") ||
                      "Calculation Formula"}
                  </Text>
                </View>
                <View
                  className="rounded-xl px-4 py-3"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <Text
                    className="text-xs font-mono leading-5"
                    style={{ color: colors.textSecondary }}
                  >
                    {
                      "Score = (Completion × 50%) +\n        (Response × 30%) +\n        ((100 - Pending) × 20%)"
                    }
                  </Text>
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
                    {t("hod.dashboard.performance.componentsTitle") ||
                      "Performance Components"}
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
                      color: colors.success || "#10B981",
                      title:
                        t("hod.dashboard.performance.completionRateTitle") ||
                        "Completion Rate",
                      weight:
                        t("hod.dashboard.performance.weight50") ||
                        "Weight: 50%",
                      value: stats
                        ? Math.round(
                            ((stats.resolved + stats.cancelled) / stats.total) *
                              100,
                          ) || 0
                        : 0,
                      barWidth:
                        stats?.total > 0
                          ? `${Math.round(((stats.resolved + stats.cancelled) / stats.total) * 100) || 0}%`
                          : "0%",
                      note: stats
                        ? `${stats.resolved + stats.cancelled} completed out of ${stats.total} total`
                        : "Loading...",
                    },
                    {
                      Icon: Timer,
                      color: colors.warning || "#F59E0B",
                      title:
                        t("hod.dashboard.performance.responseTimeTitle") ||
                        "Response Time",
                      weight:
                        t("hod.dashboard.performance.weight30") ||
                        "Weight: 30%",
                      value: responseScore,
                      barWidth: `${responseScore}%`,
                      note: stats?.avgResponseTime
                        ? `Average ${stats.avgResponseTime} hours to assign complaints`
                        : "No data available yet",
                    },
                    {
                      Icon: AlertTriangle,
                      color: "#EF4444",
                      title:
                        t("hod.dashboard.performance.pendingStatusTitle") ||
                        "Pending Status",
                      weight:
                        t("hod.dashboard.performance.weight20") ||
                        "Weight: 20%",
                      value: pendingScore,
                      barWidth: `${pendingScore}%`,
                      note: stats
                        ? `${stats.pending} pending complaints (${Math.round((stats.pending / stats.total) * 100)}% of total)`
                        : "Loading...",
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
                    style={{ color: "#FFFFFF" }}
                  >
                    {t("hod.dashboard.performance.gotIt") || "Got it"}
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
