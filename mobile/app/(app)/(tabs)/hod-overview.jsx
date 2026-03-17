import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle,
  Clock,
  Star,
  Target,
  ThumbsUp,
  Timer,
  Users,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
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

function InfoTile({ label, value, hint, colors }) {
  return (
    <View
      className="flex-1 rounded-2xl p-4"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text className="text-xs" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      <Text className="text-2xl font-bold mt-1" style={{ color: colors.textPrimary }}>
        {value}
      </Text>
      {hint ? (
        <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function MetricRow({ icon: Icon, label, value, tone, colors }) {
  return (
    <View
      className="rounded-2xl p-4 mb-3"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 pr-3">
          <View
            className="w-11 h-11 rounded-2xl items-center justify-center"
            style={{ backgroundColor: tone + "18" }}
          >
            <Icon size={20} color={tone} />
          </View>
          <Text className="text-sm font-semibold ml-3" style={{ color: colors.textPrimary }}>
            {label}
          </Text>
        </View>
        <Text className="text-xl font-bold" style={{ color: tone }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function HodOverview() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
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

  const completionRate = useMemo(() => {
    if (!stats?.total) return 0;
    return Math.round((((stats.resolved || 0) + (stats.cancelled || 0)) / stats.total) * 100);
  }, [stats]);

  const activeCount = Number(stats?.assigned || 0) + Number(stats?.inProgress || 0);
  const pendingColor = getStatusColor("pending", colors) ?? colors.warning;
  const approvalColor = getStatusColor("pending-approval", colors) ?? colors.info;
  const resolvedColor = getStatusColor("resolved", colors) ?? colors.success;
  const activeColor = getStatusColor("in-progress", colors) ?? colors.primary;
  const performanceScore = Number(stats?.performanceScore || 0);
  const performanceTone =
    performanceScore >= 80
      ? colors.success
      : performanceScore >= 60
        ? colors.warning
        : colors.danger;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.backgroundPrimary }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
      contentContainerStyle={{ padding: 16, paddingTop: 32, paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => refetch()}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {getGreeting()}
          </Text>
          <NotificationBellButton />
        </View>
        <Text className="text-3xl font-extrabold mt-1" style={{ color: colors.textPrimary }}>
          {user?.fullName ?? t("hod.dashboard.analyticsTitle")}
        </Text>
        <Text className="text-sm mt-2" style={{ color: colors.textSecondary }}>
          {user?.department ?? stats?.department ?? t("hod.dashboard.department")}
        </Text>
      </View>

      <View
        className="rounded-[28px] p-5 mb-5"
        style={{
          backgroundColor: performanceTone + "12",
          borderWidth: 1,
          borderColor: performanceTone + "45",
        }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{ backgroundColor: performanceTone + "20" }}
            >
              <Award size={22} color={performanceTone} />
            </View>
            <View className="ml-3">
              <Text className="text-xs uppercase" style={{ color: colors.textSecondary }}>
                Overall Performance
              </Text>
              <Text className="text-3xl font-extrabold mt-1" style={{ color: performanceTone }}>
                {performanceScore}
              </Text>
            </View>
          </View>
          <View
            className="px-3 py-2 rounded-full"
            style={{ backgroundColor: colors.backgroundPrimary }}
          >
            <Text className="text-xs font-bold" style={{ color: performanceTone }}>
              {completionRate}% closed
            </Text>
          </View>
        </View>

        <Text className="text-sm mt-4 leading-6" style={{ color: colors.textPrimary }}>
          Pending load, response speed, and completion output are now grouped here first so the HOD view starts with the health of the department, not the raw counts.
        </Text>

        <View className="flex-row mt-4" style={{ gap: 10 }}>
          <InfoTile
            label="Avg response"
            value={
              typeof stats?.avgResponseTime === "number"
                ? `${stats.avgResponseTime.toFixed(1)}h`
                : "-"
            }
            colors={colors}
          />
          <InfoTile
            label="Team size"
            value={Number(stats?.totalWorkers || 0)}
            colors={colors}
          />
        </View>
      </View>

      <View className="mb-4">
        <Text className="text-xs uppercase mb-3" style={{ color: colors.textSecondary }}>
          Snapshot
        </Text>
        <View className="flex-row mb-3" style={{ gap: 10 }}>
          <InfoTile
            label="Total complaints"
            value={Number(stats?.total || 0)}
            hint={`${activeCount} active right now`}
            colors={colors}
          />
          <InfoTile
            label="Pending approval"
            value={Number(stats?.pendingApproval || 0)}
            hint="Waiting for HOD review"
            colors={colors}
          />
        </View>
        <View className="flex-row" style={{ gap: 10 }}>
          <InfoTile
            label="Resolved"
            value={Number(stats?.resolved || 0)}
            hint={`${Number(stats?.cancelled || 0)} cancelled`}
            colors={colors}
          />
          <InfoTile
            label="Community support"
            value={Number(stats?.totalUpvotes || 0)}
            hint="Total complaint upvotes"
            colors={colors}
          />
        </View>
      </View>

      <View className="mb-4">
        <Text className="text-xs uppercase mb-3" style={{ color: colors.textSecondary }}>
          Workload Flow
        </Text>
        <MetricRow
          icon={AlertTriangle}
          label="Pending complaints"
          value={Number(stats?.pending || 0)}
          tone={pendingColor}
          colors={colors}
        />
        <MetricRow
          icon={Activity}
          label="Assigned and in progress"
          value={activeCount}
          tone={activeColor}
          colors={colors}
        />
        <MetricRow
          icon={Timer}
          label="Pending approval"
          value={Number(stats?.pendingApproval || 0)}
          tone={approvalColor}
          colors={colors}
        />
        <MetricRow
          icon={CheckCircle}
          label="Resolved complaints"
          value={Number(stats?.resolved || 0)}
          tone={resolvedColor}
          colors={colors}
        />
      </View>

      <View className="mb-4">
        <Text className="text-xs uppercase mb-3" style={{ color: colors.textSecondary }}>
          Priority Mix
        </Text>
        <View className="flex-row" style={{ gap: 10 }}>
          <InfoTile
            label="High"
            value={Number(stats?.highPriority || 0)}
            hint="Urgent cases"
            colors={colors}
          />
          <InfoTile
            label="Medium"
            value={Number(stats?.mediumPriority || 0)}
            hint="Standard queue"
            colors={colors}
          />
          <InfoTile
            label="Low"
            value={Number(stats?.lowPriority || 0)}
            hint="Lower urgency"
            colors={colors}
          />
        </View>
      </View>

      <View
        className="rounded-3xl p-5"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text className="text-xs uppercase mb-3" style={{ color: colors.textSecondary }}>
          Signals
        </Text>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Clock size={16} color={colors.info} />
            <Text className="text-sm font-semibold ml-2" style={{ color: colors.textPrimary }}>
              Response time
            </Text>
          </View>
          <Text className="text-sm font-bold" style={{ color: colors.info }}>
            {typeof stats?.avgResponseTime === "number" ? `${stats.avgResponseTime.toFixed(1)}h` : "-"}
          </Text>
        </View>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <ThumbsUp size={16} color={colors.primary} />
            <Text className="text-sm font-semibold ml-2" style={{ color: colors.textPrimary }}>
              Citizen feedback
            </Text>
          </View>
          <View className="flex-row items-center">
            <Star size={15} color={colors.warning} fill={colors.warning} />
            <Text className="text-sm font-bold ml-1" style={{ color: colors.textPrimary }}>
              {stats?.avgFeedbackRating ? stats.avgFeedbackRating.toFixed(1) : "-"}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Users size={16} color={colors.success} />
            <Text className="text-sm font-semibold ml-2" style={{ color: colors.textPrimary }}>
              Active workers
            </Text>
          </View>
          <Text className="text-sm font-bold" style={{ color: colors.success }}>
            {Number(stats?.activeWorkers || stats?.totalWorkers || 0)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Target size={16} color={getPriorityColor("High", colors) ?? colors.danger} />
            <Text className="text-sm font-semibold ml-2" style={{ color: colors.textPrimary }}>
              Completion rate
            </Text>
          </View>
          <Text className="text-sm font-bold" style={{ color: colors.textPrimary }}>
            {completionRate}%
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
