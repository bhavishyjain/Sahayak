import { useRouter } from "expo-router";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ClipboardList,
  ListChecks,
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
import NotificationBellButton from "../../../components/NotificationBellButton";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import getUserAuth from "../../../utils/userAuth";
import { WORKER_OVERVIEW_URL } from "../../../url";
import {
  getPriorityBackgroundColor,
  formatPriorityLabel,
  formatStatusLabel,
  getPriorityColor,
  getStatusBackgroundColor,
  getStatusColor,
} from "../../../data/complaintStatus";

export default function WorkerHome() {
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
        url: WORKER_OVERVIEW_URL,
      });

      const backendData = res?.data;
      if (backendData) {
        const transformed = {
          activeCount: backendData.statistics?.activeComplaints,
          completedCount: backendData.statistics?.totalCompleted,
          weekCompleted: backendData.statistics?.weekCompleted,
          pendingApproval: backendData.statistics?.pendingApproval,
          activeComplaints: (backendData.assignedComplaints ?? []).map((c) => ({
            id: c._id,
            ticketId: c.ticketId,
            title:
              c.title ??
              c.rawText?.split(":")?.[0] ??
              t("worker.dashboard.complaintFallback"),
            description:
              c.description ??
              c.refinedText ??
              c.rawText ??
              t("worker.dashboard.complaintFallback"),
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
        text2: e?.response?.data?.message ?? t("worker.dashboard.loadingError"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
    getUserAuth()
      .then((userData) => {
        if (userData) {
          setUser(userData);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  const activeComplaints = dashboardData?.activeComplaints ?? [];
  const completionPercent =
    dashboardData?.activeCount > 0
      ? Math.round(
          (dashboardData.completedCount /
            (dashboardData.completedCount + dashboardData.activeCount)) *
            100,
        )
      : 100;
  const ratingValue = Number(user?.rating ?? 0);
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;
  const ratingPercent = Math.max(0, Math.min((ratingValue / 5) * 100, 100));
  const pendingApprovalColor =
    getStatusColor("pending-approval", colors) ?? colors.warning;
  const pendingApprovalBackground =
    getStatusBackgroundColor("pending-approval", colors, "20") ??
    `${colors.warning}20`;

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
            {user?.fullName ?? t("worker.dashboard.workerFallback")}
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
                {user?.department
                  ? `${user.department} ${t("worker.dashboard.department")}`
                  : t("worker.dashboard.department")}
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
                iconColor={colors.warning}
                iconBgColor={colors.warning + "20"}
                title={t("worker.dashboard.stats.active")}
                value={dashboardData.activeCount ?? 0}
                subtitle={t("worker.dashboard.stats.assigned")}
                valueColor={colors.warning}
                style={{ marginRight: 6 }}
              />

              <MetricCard
                colors={colors}
                Icon={CheckCircle}
                iconColor={colors.success}
                iconBgColor={colors.success + "20"}
                title={t("worker.dashboard.stats.completed")}
                value={dashboardData.completedCount ?? 0}
                subtitle={t("worker.dashboard.stats.total")}
                valueColor={colors.success}
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
                        backgroundColor: pendingApprovalBackground,
                      }}
                    >
                      <AlertCircle size={20} color={pendingApprovalColor} />
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
                    style={{ color: pendingApprovalColor }}
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
                    <Star
                      size={16}
                      color={colors.warning}
                      fill={colors.warning}
                    />
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
                    {hasRating
                      ? ratingValue.toFixed(1)
                      : t("worker.dashboard.notAvailable")}
                    <Text
                      className="text-sm font-normal"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("worker.dashboard.ratingOutOfFive")}
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
                      width: `${ratingPercent}%`,
                      backgroundColor: colors.warning,
                    }}
                  />
                </View>
              </View>

              {/* Week Performance */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <Flame size={16} color={colors.info} />
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
                    {dashboardData?.weekCompleted ?? 0}
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
                    <Target size={16} color={colors.success} />
                    <Text
                      className="text-sm font-semibold ml-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("worker.dashboard.completionRate")}
                    </Text>
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.success }}
                  >
                    {completionPercent}%
                  </Text>
                </View>
                <View
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${completionPercent}%`,
                      backgroundColor: colors.success,
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
              {activeComplaints.length > 3 && (
                <PressableBlock onPress={() => router.push("/worker-assigned")}>
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.primary }}
                  >
                    {t("worker.dashboard.viewAll")}
                  </Text>
                </PressableBlock>
              )}
            </View>

            {activeComplaints.length > 0 ? (
              activeComplaints.slice(0, 3).map((complaint) => {
                const priorityColor =
                  getPriorityColor(complaint.priority, colors) ??
                  colors.textSecondary;
                const priorityBackgroundColor =
                  getPriorityBackgroundColor(
                    complaint.priority,
                    colors,
                    "20",
                  ) ?? `${colors.textSecondary}20`;

                return (
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
                        <View className="flex-row items-center">
                          <ListChecks
                            size={12}
                            color={colors.primary}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            className="text-sm font-bold"
                            style={{ color: colors.primary }}
                          >
                            {complaint.ticketId}
                          </Text>
                        </View>
                        <View
                          className="px-2 py-1 rounded"
                          style={{
                            backgroundColor: priorityBackgroundColor,
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{
                              color: priorityColor,
                            }}
                          >
                            {formatPriorityLabel(t, complaint.priority)}
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
                          {formatStatusLabel(t, complaint.status)}
                        </Text>
                      </View>
                    </Card>
                  </PressableBlock>
                );
              })
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
