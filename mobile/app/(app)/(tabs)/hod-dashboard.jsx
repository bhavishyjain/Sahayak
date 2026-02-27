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
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import Card from "../../../components/Card";
import MetricCard from "../../../components/MetricCard";
import { useTheme } from "../../../utils/context/theme";
import apiCall from "../../../utils/api";
import { HOD_DASHBOARD_URL } from "../../../url";

export default function HodDashboard() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

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
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not load dashboard",
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
          Analytics Dashboard
        </Text>
        <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
          {stats?.department || "Department"} Performance Overview
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            Loading analytics...
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
                      Total Complaints
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
                        Pending
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
                        Assigned
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
                        In Progress
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
                          Awaiting Approval
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
                  title="Resolved"
                  value={stats.resolved || 0}
                  subtitle={
                    stats.total > 0
                      ? `${Math.round((stats.resolved / stats.total) * 100)}% completion`
                      : "0% completion"
                  }
                  valueColor={colors.success || "#10B981"}
                  style={{ marginRight: 6 }}
                />

                <MetricCard
                  colors={colors}
                  Icon={TrendingDown}
                  iconColor={colors.textSecondary}
                  iconBgColor={colors.backgroundSecondary}
                  title="Cancelled"
                  value={stats.cancelled || 0}
                  subtitle="Cancelled cases"
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
                    Department Efficiency
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
                        Completion Rate
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
                        Active Work Rate
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
                        Pending Rate
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
                    Priority Distribution
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
                      High
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
                      Medium
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
                      Low
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
                  title="Active Workers"
                  value={stats.activeWorkers || 0}
                  subtitle={`${stats.totalWorkers || 0} total workers`}
                  style={{ marginRight: 6 }}
                />

                <MetricCard
                  colors={colors}
                  Icon={Clock}
                  iconColor={colors.purple || "#8B5CF6"}
                  iconBgColor={(colors.purple || "#8B5CF6") + "20"}
                  title="Avg Response"
                  value={stats.avgResponseTime || "N/A"}
                  subtitle={stats.avgResponseTime ? "hours to assign" : "No data"}
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
                    Public Engagement
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
                      Overall Performance
                    </Text>
                  </View>
                  <Text
                    className="text-2xl font-bold"
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
                  Based on completion rate, response time, and citizen feedback
                </Text>
              </Card>
            </>
          )}

          {!stats && (
            <Card style={{ margin: 0, marginTop: 20 }}>
              <View className="items-center py-8">
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.textSecondary }}
                >
                  No analytics data available
                </Text>
              </View>
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}
