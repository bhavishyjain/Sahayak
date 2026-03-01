import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Users,
  Clock,
  AlertTriangle,
  Award,
  ThumbsUp,
  Info,
  X,
  Calculator,
  Target,
  CheckCircle,
  Timer,
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
import Card from "../../../components/Card";
import MetricCard from "../../../components/MetricCard";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import { HOD_DASHBOARD_URL } from "../../../url";

export default function HodDashboard() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: HOD_DASHBOARD_URL,
      });

      const payload = res?.data;
      setStats(payload?.stats || null);
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
  }, []);

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <View className="px-4 pt-12 pb-4">
        <Text
          className="text-2xl font-bold"
          style={{ color: colors.textPrimary }}
        >
          {t("hod.dashboard.analyticsTitle")}
        </Text>
        <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
          {stats?.department || t("hod.dashboard.department")}{" "}
          {t("hod.dashboard.performanceOverview")}
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            {t("hod.dashboard.loadingAnalytics")}
          </Text>
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
          {/* Main Statistics Grid */}
          {stats && (
            <>
              {/* Total Complaints Card */}
              <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.primary + "20" }}
                    >
                      <BarChart3 size={20} color={colors.primary} />
                    </View>
                    <Text
                      className="text-sm font-semibold ml-3"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.dashboard.complaints.total")}
                    </Text>
                  </View>
                  <Text
                    className="text-3xl font-bold"
                    style={{ color: colors.primary }}
                  >
                    {stats.total || 0}
                  </Text>
                </View>

                <View
                  className="h-[1px] mb-4"
                  style={{ backgroundColor: colors.border }}
                />

                <View className="mb-3">
                  <View className="flex-row justify-between">
                    <View className="flex-1 items-center">
                      <Text
                        className="text-xs mb-1"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("hod.dashboard.complaints.pending")}
                      </Text>
                      <Text
                        className="text-xl font-bold"
                        style={{ color: colors.warning || "#F59E0B" }}
                      >
                        {stats.pending || 0}
                      </Text>
                    </View>

                    <View
                      className="w-[1px]"
                      style={{ backgroundColor: colors.border }}
                    />

                    <View className="flex-1 items-center">
                      <Text
                        className="text-xs mb-1"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("hod.dashboard.complaints.assigned")}
                      </Text>
                      <Text
                        className="text-xl font-bold"
                        style={{ color: colors.info || "#3B82F6" }}
                      >
                        {stats.assigned || 0}
                      </Text>
                    </View>

                    <View
                      className="w-[1px]"
                      style={{ backgroundColor: colors.border }}
                    />

                    <View className="flex-1 items-center">
                      <Text
                        className="text-xs mb-1"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("hod.dashboard.complaints.inProgress")}
                      </Text>
                      <Text
                        className="text-xl font-bold"
                        style={{ color: colors.purple || "#8B5CF6" }}
                      >
                        {stats.inProgress || 0}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Pending Approval Row */}
                {stats.pendingApproval > 0 && (
                  <>
                    <View
                      className="h-[1px] mb-3"
                      style={{ backgroundColor: colors.border }}
                    />
                    <View className="flex-row items-center justify-between px-2">
                      <View className="flex-row items-center">
                        <AlertTriangle
                          size={18}
                          color={colors.purple || "#8B5CF6"}
                        />
                        <Text
                          className="text-xs ml-2"
                          style={{ color: colors.textSecondary }}
                        >
                          {t("hod.dashboard.awaitingApproval") ||
                            "Awaiting Approval"}
                        </Text>
                      </View>
                      <Text
                        className="text-xl font-bold"
                        style={{ color: colors.purple || "#8B5CF6" }}
                      >
                        {stats.pendingApproval}
                      </Text>
                    </View>
                  </>
                )}
              </Card>

              {/* Completion Stats */}
              <View className="flex-row mb-4">
                <MetricCard
                  colors={colors}
                  Icon={TrendingUp}
                  iconColor={colors.success || "#10B981"}
                  iconBgColor={(colors.success || "#10B981") + "20"}
                  title={t("hod.dashboard.complaints.resolved")}
                  value={stats.resolved || 0}
                  subtitle={
                    stats.total > 0
                      ? `${Math.round((stats.resolved / stats.total) * 100)}% ${t("hod.dashboard.completion") || "completion"}`
                      : `0% ${t("hod.dashboard.completion") || "completion"}`
                  }
                  valueColor={colors.success || "#10B981"}
                  style={{ marginRight: 6 }}
                />

                <MetricCard
                  colors={colors}
                  Icon={TrendingDown}
                  iconColor={colors.textSecondary}
                  iconBgColor={colors.backgroundSecondary}
                  title={t("hod.dashboard.complaints.cancelled")}
                  value={stats.cancelled || 0}
                  subtitle={t("hod.dashboard.complaints.cancelledCases")}
                  style={{ marginLeft: 6 }}
                />
              </View>

              {/* Department Efficiency */}
              <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
                <View className="flex-row items-center mb-3">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: colors.info + "20" || "#3B82F620",
                    }}
                  >
                    <PieChart size={20} color={colors.info || "#3B82F6"} />
                  </View>
                  <Text
                    className="text-base font-semibold ml-3"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("hod.dashboard.departmentEfficiency") ||
                      "Department Efficiency"}
                  </Text>
                </View>

                <View
                  className="h-[1px] mb-3"
                  style={{ backgroundColor: colors.border }}
                />

                <View className="space-y-3">
                  {/* Completion Rate */}
                  <View>
                    <View className="flex-row justify-between mb-2">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("hod.dashboard.performance.completionRate")}
                      </Text>
                      <Text
                        className="text-sm font-bold"
                        style={{ color: colors.primary }}
                      >
                        {stats.total > 0
                          ? `${Math.round(((stats.resolved + stats.cancelled) / stats.total) * 100)}%`
                          : "0%"}
                      </Text>
                    </View>
                    <View
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: colors.backgroundSecondary }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width:
                            stats.total > 0
                              ? `${Math.round(((stats.resolved + stats.cancelled) / stats.total) * 100)}%`
                              : "0%",
                          backgroundColor: colors.success || "#10B981",
                        }}
                      />
                    </View>
                  </View>

                  {/* Active Work Rate */}
                  <View className="mt-3">
                    <View className="flex-row justify-between mb-2">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("hod.dashboard.activeWorkRate") ||
                          "Active Work Rate"}
                      </Text>
                      <Text
                        className="text-sm font-bold"
                        style={{ color: colors.info || "#3B82F6" }}
                      >
                        {stats.total > 0
                          ? `${Math.round(((stats.assigned + stats.inProgress) / stats.total) * 100)}%`
                          : "0%"}
                      </Text>
                    </View>
                    <View
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: colors.backgroundSecondary }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width:
                            stats.total > 0
                              ? `${Math.round(((stats.assigned + stats.inProgress) / stats.total) * 100)}%`
                              : "0%",
                          backgroundColor: colors.info || "#3B82F6",
                        }}
                      />
                    </View>
                  </View>

                  {/* Pending Rate */}
                  <View className="mt-3">
                    <View className="flex-row justify-between mb-2">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("hod.dashboard.performance.pendingRate")}
                      </Text>
                      <Text
                        className="text-sm font-bold"
                        style={{ color: colors.warning || "#F59E0B" }}
                      >
                        {stats.total > 0
                          ? `${Math.round((stats.pending / stats.total) * 100)}%`
                          : "0%"}
                      </Text>
                    </View>
                    <View
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: colors.backgroundSecondary }}
                    >
                      <View
                        className="h-full rounded-full"
                        style={{
                          width:
                            stats.total > 0
                              ? `${Math.round((stats.pending / stats.total) * 100)}%`
                              : "0%",
                          backgroundColor: colors.warning || "#F59E0B",
                        }}
                      />
                    </View>
                  </View>
                </View>
              </Card>

              {/* Priority Distribution */}
              <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
                <View className="flex-row items-center mb-3">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: colors.warning + "20" || "#F59E0B20",
                    }}
                  >
                    <AlertTriangle
                      size={20}
                      color={colors.warning || "#F59E0B"}
                    />
                  </View>
                  <Text
                    className="text-base font-semibold ml-3"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("hod.dashboard.priorityDistribution")}
                  </Text>
                </View>

                <View
                  className="h-[1px] mb-3"
                  style={{ backgroundColor: colors.border }}
                />

                <View className="flex-row justify-between">
                  <View className="flex-1 items-center">
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center mb-2"
                      style={{ backgroundColor: "#EF444420" }}
                    >
                      <Text
                        className="text-lg font-bold"
                        style={{ color: "#EF4444" }}
                      >
                        {stats.highPriority || 0}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("complaints.priority.high")}
                    </Text>
                  </View>

                  <View className="flex-1 items-center">
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center mb-2"
                      style={{
                        backgroundColor: colors.warning + "20" || "#F59E0B20",
                      }}
                    >
                      <Text
                        className="text-lg font-bold"
                        style={{ color: colors.warning || "#F59E0B" }}
                      >
                        {stats.mediumPriority || 0}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("complaints.priority.medium")}
                    </Text>
                  </View>

                  <View className="flex-1 items-center">
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center mb-2"
                      style={{
                        backgroundColor: colors.success + "20" || "#10B98120",
                      }}
                    >
                      <Text
                        className="text-lg font-bold"
                        style={{ color: colors.success || "#10B981" }}
                      >
                        {stats.lowPriority || 0}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("complaints.priority.low")}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Worker Performance & Response Time */}
              <View className="flex-row mb-4">
                <MetricCard
                  colors={colors}
                  Icon={Users}
                  iconColor={colors.info || "#3B82F6"}
                  iconBgColor={(colors.info || "#3B82F6") + "20"}
                  title={t("hod.dashboard.workers.active")}
                  value={stats.activeWorkers || 0}
                  subtitle={`${stats.totalWorkers || 0} ${t("hod.dashboard.workers.totalWorkers") || "total workers"}`}
                  style={{ marginRight: 6 }}
                />

                <MetricCard
                  colors={colors}
                  Icon={Clock}
                  iconColor={colors.purple || "#8B5CF6"}
                  iconBgColor={(colors.purple || "#8B5CF6") + "20"}
                  title={t("hod.dashboard.workers.avgResponse")}
                  value={stats.avgResponseTime || "N/A"}
                  subtitle={
                    stats.avgResponseTime
                      ? t("hod.dashboard.hoursToAssign") || "hours to assign"
                      : t("hod.dashboard.noData") || "No data"
                  }
                  style={{ marginLeft: 6 }}
                />
              </View>

              {/* Public Engagement */}
              <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
                <View className="flex-row items-center mb-3">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.primary + "20" }}
                  >
                    <ThumbsUp size={20} color={colors.primary} />
                  </View>
                  <Text
                    className="text-base font-semibold ml-3"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("hod.dashboard.publicEngagement") || "Public Engagement"}
                  </Text>
                </View>

                <View
                  className="h-[1px] mb-3"
                  style={{ backgroundColor: colors.border }}
                />

                <View className="flex-row justify-between">
                  <View className="flex-1">
                    <Text
                      className="text-xs mb-1"
                      style={{ color: colors.textSecondary }}
                    >
                      Total Upvotes
                    </Text>
                    <Text
                      className="text-2xl font-bold"
                      style={{ color: colors.primary }}
                    >
                      {stats.totalUpvotes || 0}
                    </Text>
                  </View>

                  <View
                    className="w-[1px] mx-4"
                    style={{ backgroundColor: colors.border }}
                  />

                  <View className="flex-1">
                    <Text
                      className="text-xs mb-1"
                      style={{ color: colors.textSecondary }}
                    >
                      Avg per Complaint
                    </Text>
                    <Text
                      className="text-2xl font-bold"
                      style={{ color: colors.textPrimary }}
                    >
                      {stats.total > 0
                        ? Math.round((stats.totalUpvotes || 0) / stats.total)
                        : 0}
                    </Text>
                  </View>
                </View>
              </Card>

              {/* Performance Score */}
              <TouchableOpacity
                onPress={() => setShowPerformanceModal(true)}
                activeOpacity={0.7}
              >
                <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{
                          backgroundColor: colors.success + "20" || "#10B98120",
                        }}
                      >
                        <Award size={20} color={colors.success || "#10B981"} />
                      </View>
                      <Text
                        className="text-base font-semibold ml-3"
                        style={{ color: colors.textPrimary }}
                      >
                        {t("hod.dashboard.performance.overallPerformance")}
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Text
                        className="text-2xl font-bold mr-2"
                        style={{
                          color:
                            stats.performanceScore >= 80
                              ? colors.success || "#10B981"
                              : stats.performanceScore >= 60
                                ? colors.warning || "#F59E0B"
                                : "#EF4444",
                        }}
                      >
                        {stats.performanceScore || 0}%
                      </Text>
                      <Info size={18} color={colors.textSecondary} />
                    </View>
                  </View>

                  <View
                    className="h-3 rounded-full overflow-hidden"
                    style={{ backgroundColor: colors.backgroundSecondary }}
                  >
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${stats.performanceScore || 0}%`,
                        backgroundColor:
                          stats.performanceScore >= 80
                            ? colors.success || "#10B981"
                            : stats.performanceScore >= 60
                              ? colors.warning || "#F59E0B"
                              : "#EF4444",
                      }}
                    />
                  </View>

                  <Text
                    className="text-xs mt-2 text-center"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("hod.dashboard.performance.tapToSeeDetails")}
                  </Text>
                </Card>
              </TouchableOpacity>
            </>
          )}

          {!stats && (
            <Card style={{ margin: 0, marginTop: 20 }}>
              <View className="items-center py-8">
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.textSecondary }}
                >
                  {t("hod.dashboard.noAnalyticsData")}
                </Text>
              </View>
            </Card>
          )}
        </ScrollView>
      )}

      {/* Performance Calculation Modal */}
      <Modal
        visible={showPerformanceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPerformanceModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center px-4"
          onPress={() => setShowPerformanceModal(false)}
        >
          <Pressable
            className="w-full max-w-md rounded-2xl p-6"
            style={{ backgroundColor: colors.backgroundPrimary }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{
                    backgroundColor: colors.success + "20" || "#10B98120",
                  }}
                >
                  <Award size={20} color={colors.success || "#10B981"} />
                </View>
                <Text
                  className="text-xl font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  Performance Calculation
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPerformanceModal(false)}
                className="p-1"
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current Score */}
            <View
              className="rounded-xl p-4 mb-4"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <Text
                className="text-sm mb-1"
                style={{ color: colors.textSecondary }}
              >
                Current Performance Score
              </Text>
              <Text
                className="text-4xl font-bold"
                style={{
                  color:
                    (stats?.performanceScore || 0) >= 80
                      ? colors.success || "#10B981"
                      : (stats?.performanceScore || 0) >= 60
                        ? colors.warning || "#F59E0B"
                        : "#EF4444",
                }}
              >
                {stats?.performanceScore || 0}%
              </Text>
            </View>

            {/* Formula */}
            <View className="mb-4">
              <View className="flex-row items-center mb-2">
                <Calculator size={16} color={colors.primary} />
                <Text
                  className="text-sm font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  Calculation Formula
                </Text>
              </View>
              <View
                className="rounded-lg p-3"
                style={{ backgroundColor: colors.backgroundSecondary }}
              >
                <Text
                  className="text-xs font-mono leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  Score = (Completion × 50%) +{"\n"}
                  (Response × 30%) +{"\n"}
                  ((100 - Pending) × 20%)
                </Text>
              </View>
            </View>

            {/* Components Breakdown */}
            <View className="mb-2">
              <View className="flex-row items-center mb-3">
                <Target size={16} color={colors.primary} />
                <Text
                  className="text-sm font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  Performance Components
                </Text>
              </View>

              {/* Completion Rate */}
              <View
                className="mb-3 rounded-lg p-3"
                style={{ backgroundColor: colors.backgroundSecondary }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.success + "20" }}
                    >
                      <CheckCircle
                        size={16}
                        color={colors.success || "#10B981"}
                      />
                    </View>
                    <View className="ml-2 flex-1">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.textPrimary }}
                      >
                        Completion Rate
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        Weight: 50%
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.success || "#10B981" }}
                  >
                    {stats
                      ? Math.round(
                          ((stats.resolved + stats.cancelled) / stats.total) *
                            100,
                        ) || 0
                      : 0}
                    %
                  </Text>
                </View>
                <View
                  className="h-2 rounded-full mb-2"
                  style={{ backgroundColor: colors.backgroundPrimary }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: stats
                        ? `${Math.round(((stats.resolved + stats.cancelled) / stats.total) * 100) || 0}%`
                        : "0%",
                      backgroundColor: colors.success || "#10B981",
                    }}
                  />
                </View>
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {stats
                    ? `${stats.resolved + stats.cancelled} completed out of ${stats.total} total complaints`
                    : "Loading..."}
                </Text>
              </View>

              {/* Response Score */}
              <View
                className="mb-3 rounded-lg p-3"
                style={{ backgroundColor: colors.backgroundSecondary }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: colors.warning + "20" || "#F59E0B20",
                      }}
                    >
                      <Timer size={16} color={colors.warning || "#F59E0B"} />
                    </View>
                    <View className="ml-2 flex-1">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.textPrimary }}
                      >
                        Response Time
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        Weight: 30%
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.warning || "#F59E0B" }}
                  >
                    {stats?.avgResponseTime
                      ? Math.max(0, Math.round(100 - stats.avgResponseTime * 2))
                      : 50}
                    %
                  </Text>
                </View>
                <View
                  className="h-2 rounded-full mb-2"
                  style={{ backgroundColor: colors.backgroundPrimary }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: stats?.avgResponseTime
                        ? `${Math.max(0, Math.round(100 - stats.avgResponseTime * 2))}%`
                        : "50%",
                      backgroundColor: colors.warning || "#F59E0B",
                    }}
                  />
                </View>
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {stats?.avgResponseTime
                    ? `Average ${stats.avgResponseTime} hours to assign complaints`
                    : "No data available yet"}
                </Text>
              </View>

              {/* Pending Penalty */}
              <View
                className="mb-3 rounded-lg p-3"
                style={{ backgroundColor: colors.backgroundSecondary }}
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: "#EF444420" }}
                    >
                      <AlertTriangle size={16} color="#EF4444" />
                    </View>
                    <View className="ml-2 flex-1">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.textPrimary }}
                      >
                        Pending Status
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        Weight: 20%
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: "#EF4444" }}
                  >
                    {stats
                      ? Math.round(100 - (stats.pending / stats.total) * 30) ||
                        100
                      : 100}
                    %
                  </Text>
                </View>
                <View
                  className="h-2 rounded-full mb-2"
                  style={{ backgroundColor: colors.backgroundPrimary }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: stats
                        ? `${Math.round(100 - (stats.pending / stats.total) * 30) || 100}%`
                        : "100%",
                      backgroundColor: "#EF4444",
                    }}
                  />
                </View>
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {stats
                    ? `${stats.pending} pending complaints (${Math.round((stats.pending / stats.total) * 100)}% of total)`
                    : "Loading..."}
                </Text>
              </View>
            </View>

            {/* Close Button */}
            <Pressable
              className="rounded-xl py-3 mt-2"
              style={{ backgroundColor: colors.primary }}
              onPress={() => setShowPerformanceModal(false)}
            >
              <Text
                className="text-center font-semibold"
                style={{ color: "#FFFFFF" }}
              >
                Got it
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
