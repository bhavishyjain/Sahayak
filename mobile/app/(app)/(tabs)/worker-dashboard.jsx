import { useRouter } from "expo-router";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ClipboardList,
  Star,
  Award,
  Target,
  Flame,
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
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import getUserAuth from "../../../utils/userAuth";
import { WORKER_DASHBOARD_URL } from "../../../url";
import { getPriorityColor } from "../../../utils/colorHelpers";

export default function WorkerDashboard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
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

      const res = await apiCall({
        method: "GET",
        url: WORKER_DASHBOARD_URL,
      });

      const backendData = res?.data;
      if (backendData) {
        const transformed = {
          activeCount: backendData.statistics?.activeComplaints || 0,
          completedCount: backendData.statistics?.totalCompleted || 0,
          weekCompleted: backendData.statistics?.weekCompleted || 0,
          pendingApproval: backendData.statistics?.pendingApproval || 0,
          activeComplaints: (backendData.assignedComplaints || []).map((c) => ({
            id: c._id,
            ticketId: c.ticketId,
            title: c.title || c.rawText?.split(":")[0] || "Complaint",
            description: c.description || c.refinedText || c.rawText,
            priority: c.priority,
            status: c.status,
          })),
        };
        setDashboardData(transformed);
      }
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("worker.dashboard.failed"),
        text2: e?.response?.data?.message || t("worker.dashboard.loadingError"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
    getUserAuth().then((userData) => {
      if (userData) {
        setUser(userData);
      }
    });
  }, []);

  if (loading) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-sm mt-3" style={{ color: colors.textSecondary }}>
          {t("worker.dashboard.loading")}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header with Gradient Effect */}
        <View className="px-4 pt-12 pb-6">
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {getGreeting()}
          </Text>
          <Text
            className="text-3xl font-bold mt-1"
            style={{ color: colors.textPrimary }}
          >
            {user?.fullName || "Worker"}
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
                {user?.department || ""} {t("worker.dashboard.department")}
              </Text>
            </View>
          </View>
        </View>

        {/* Statistics Grid */}
        {dashboardData && (
          <View className="px-4">
            {/* Main Stats Row */}
            <View className="flex-row mb-4">
              <MetricCard
                colors={colors}
                Icon={Clock}
                iconColor={colors.warning || "#F59E0B"}
                iconBgColor={(colors.warning || "#F59E0B") + "20"}
                title={t("worker.dashboard.stats.active")}
                value={dashboardData.activeCount || 0}
                subtitle={t("worker.dashboard.stats.assigned")}
                valueColor={colors.warning || "#F59E0B"}
                style={{ marginRight: 6 }}
              />

              <MetricCard
                colors={colors}
                Icon={CheckCircle}
                iconColor={colors.success || "#10B981"}
                iconBgColor={(colors.success || "#10B981") + "20"}
                title={t("worker.dashboard.stats.completed")}
                value={dashboardData.completedCount || 0}
                subtitle={t("worker.dashboard.stats.total")}
                valueColor={colors.success || "#10B981"}
                style={{ marginLeft: 6 }}
              />
            </View>

            {/* Pending Approval Alert */}
            {dashboardData.pendingApproval > 0 && (
              <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: colors.purple + "20" || "#8B5CF620",
                      }}
                    >
                      <AlertCircle
                        size={20}
                        color={colors.purple || "#8B5CF6"}
                      />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("worker.dashboard.awaitingApproval")}
                      </Text>
                      <Text
                        className="text-sm mt-1"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("worker.dashboard.hodReview")}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="text-3xl font-bold"
                    style={{ color: colors.purple || "#8B5CF6" }}
                  >
                    {dashboardData.pendingApproval}
                  </Text>
                </View>
              </Card>
            )}

            {/* Performance Card with Progress Bars */}
            <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
              <View className="flex-row items-center mb-4">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.primary + "20" }}
                >
                  <TrendingUp size={20} color={colors.primary} />
                </View>
                <Text
                  className="text-base font-bold ml-3"
                  style={{ color: colors.textPrimary }}
                >
                  {t("worker.dashboard.performanceOverview")}
                </Text>
              </View>

              <View
                className="h-[1px] mb-4"
                style={{ backgroundColor: colors.border }}
              />

              {/* Rating Section */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Star size={16} color="#EAB308" fill="#EAB308" />
                    <Text
                      className="text-sm font-semibold ml-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("worker.dashboard.averageRating")}
                    </Text>
                  </View>
                  <Text
                    className="text-2xl font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {user?.rating ? user.rating.toFixed(1) : "4.5"}
                    <Text
                      className="text-sm font-normal"
                      style={{ color: colors.textSecondary }}
                    >
                      /5.0
                    </Text>
                  </Text>
                </View>
                <View
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${((user?.rating || 4.5) / 5) * 100}%`,
                      backgroundColor: "#EAB308",
                    }}
                  />
                </View>
              </View>

              {/* Week Performance */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Flame size={16} color={colors.info || "#3B82F6"} />
                    <Text
                      className="text-sm font-semibold ml-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("worker.dashboard.thisWeek")}
                    </Text>
                  </View>
                  <Text
                    className="text-2xl font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {dashboardData?.weekCompleted || 0}
                    <Text
                      className="text-sm font-normal"
                      style={{ color: colors.textSecondary }}
                    >
                      {" "}
                      {t("worker.dashboard.completed")}
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Completion Rate */}
              <View>
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Target size={16} color={colors.success || "#10B981"} />
                    <Text
                      className="text-sm font-semibold ml-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("worker.dashboard.completionRate")}
                    </Text>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.success || "#10B981" }}
                  >
                    {dashboardData.activeCount > 0
                      ? Math.round(
                          (dashboardData.completedCount /
                            (dashboardData.completedCount +
                              dashboardData.activeCount)) *
                            100,
                        )
                      : 100}
                    %
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
                        dashboardData.activeCount > 0
                          ? `${Math.round((dashboardData.completedCount / (dashboardData.completedCount + dashboardData.activeCount)) * 100)}%`
                          : "100%",
                      backgroundColor: colors.success || "#10B981",
                    }}
                  />
                </View>
              </View>
            </Card>

            {/* Achievement Badge */}
            {dashboardData.completedCount > 0 && (
              <Card
                style={{
                  margin: 0,
                  marginBottom: 16,
                  flex: 0,
                  backgroundColor:
                    colorScheme === "dark"
                      ? colors.primary + "15"
                      : colors.primary + "10",
                  borderWidth: 1,
                  borderColor: colors.primary + "30",
                }}
              >
                <View className="flex-row items-center">
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.primary + "30" }}
                  >
                    <Award size={24} color={colors.primary} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="text-sm font-bold"
                      style={{ color: colors.primary }}
                    >
                      {dashboardData.completedCount >= 100
                        ? t("worker.dashboard.achievement.centuryClub")
                        : dashboardData.completedCount >= 50
                          ? t("worker.dashboard.achievement.communityHero")
                          : t("worker.dashboard.achievement.keepGoing")}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: colors.textSecondary }}
                    >
                      {dashboardData.completedCount >= 100
                        ? t("worker.dashboard.achievement.centuryDesc")
                        : dashboardData.completedCount >= 50
                          ? t("worker.dashboard.achievement.heroDesc")
                          : t("worker.dashboard.achievement.moreToHero", {
                              count: 50 - dashboardData.completedCount,
                            })}
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Active Assignments Section */}
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                {t("worker.dashboard.activeAssignments")}
              </Text>
              {dashboardData.activeComplaints &&
                dashboardData.activeComplaints.length > 3 && (
                  <PressableBlock
                    onPress={() => router.push("/worker-assigned")}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{ color: colors.primary }}
                    >
                      {t("worker.dashboard.viewAll")}
                    </Text>
                  </PressableBlock>
                )}
            </View>

            {dashboardData.activeComplaints &&
            dashboardData.activeComplaints.length > 0 ? (
              dashboardData.activeComplaints.slice(0, 3).map((complaint) => (
                <PressableBlock
                  key={complaint.id}
                  onPress={() =>
                    router.push(
                      `/complaints/complaint-details?id=${complaint.id}`,
                    )
                  }
                >
                  <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                    <View className="flex-row items-start justify-between mb-2">
                      <Text
                        className="text-sm font-bold"
                        style={{ color: colors.primary }}
                      >
                        #{complaint.ticketId}
                      </Text>
                      <View
                        className="px-2 py-1 rounded"
                        style={{
                          backgroundColor:
                            getPriorityColor(complaint.priority, colors) + "20",
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{
                            color: getPriorityColor(complaint.priority, colors),
                          }}
                        >
                          {complaint.priority}
                        </Text>
                      </View>
                    </View>

                    <Text
                      className="text-base font-semibold mb-2"
                      style={{ color: colors.textPrimary }}
                    >
                      {complaint.title}
                    </Text>

                    <Text
                      className="text-sm mb-2"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={2}
                    >
                      {complaint.description}
                    </Text>

                    <View className="flex-row items-center">
                      <ClipboardList size={12} color={colors.textSecondary} />
                      <Text
                        className="text-xs ml-1 capitalize"
                        style={{ color: colors.textSecondary }}
                      >
                        {complaint.status?.replace("-", " ")}
                      </Text>
                    </View>
                  </Card>
                </PressableBlock>
              ))
            ) : (
              <Card style={{ margin: 0, marginBottom: 16 }}>
                <View className="items-center py-6">
                  <AlertCircle size={32} color={colors.textSecondary} />
                  <Text
                    className="text-base font-semibold mt-3"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("worker.dashboard.noActiveAssignments")}
                  </Text>
                  <Text
                    className="text-sm mt-1 text-center"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("worker.dashboard.allCaughtUp")}
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
