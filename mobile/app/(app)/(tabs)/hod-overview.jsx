import { useFocusEffect } from "expo-router";
import {
  Activity,
  AlertTriangle,
  Award,
  ChevronRight,
  CheckCircle,
  Clock,
  Star,
  Target,
  ThumbsUp,
  Timer,
  Users,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
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
      <Text
        className="text-2xl font-bold mt-1"
        style={{ color: colors.textPrimary }}
      >
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
          <Text
            className="text-sm font-semibold ml-3"
            style={{ color: colors.textPrimary }}
          >
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
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const completionRate = useMemo(() => {
    if (!stats?.total) return 0;
    return Math.round(
      (((stats.resolved || 0) + (stats.cancelled || 0)) / stats.total) * 100,
    );
  }, [stats]);

  const activeCount =
    Number(stats?.assigned || 0) +
    Number(stats?.inProgress || 0) +
    Number(stats?.needsRework || 0) +
    Number(stats?.pendingApproval || 0);
  const pendingColor = getStatusColor("pending", colors) ?? colors.warning;
  const approvalColor =
    getStatusColor("pending-approval", colors) ?? colors.info;
  const resolvedColor = getStatusColor("resolved", colors) ?? colors.success;
  const activeColor = getStatusColor("in-progress", colors) ?? colors.primary;
  const reworkColor = getStatusColor("needs-rework", colors) ?? colors.danger;
  const performanceScore = Number(stats?.performanceScore || 0);
  const performanceTone =
    performanceScore >= 80
      ? colors.success
      : performanceScore >= 60
        ? colors.warning
        : colors.danger;
  const pendingScore = useMemo(() => {
    if (!stats?.total) return 0;
    return Math.max(
      0,
      Math.min(
        100,
        100 - Math.round((Number(stats?.pending || 0) / stats.total) * 100),
      ),
    );
  }, [stats]);
  const responseScore = useMemo(() => {
    if (typeof stats?.avgResponseTime !== "number") return 0;
    return Math.max(
      0,
      Math.min(100, Math.round((24 - stats.avgResponseTime) * 4)),
    );
  }, [stats]);

  if (loading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
      contentContainerStyle={{
        padding: 16,
        paddingTop: 32,
        paddingBottom: 120,
      }}
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
        <Text
          className="text-3xl font-extrabold mt-1"
          style={{ color: colors.textPrimary }}
        >
          {user?.fullName ?? t("hod.dashboard.analyticsTitle")}
        </Text>
        <Text className="text-sm mt-2" style={{ color: colors.textSecondary }}>
          {user?.department ?? stats?.department}{" "}
          {t("hod.dashboard.department")}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => setShowPerformanceModal(true)}
        activeOpacity={0.8}
        className="rounded-2xl mb-5"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.backgroundSecondary,
        }}
      >
        <View className="flex-row items-center py-3 px-4">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center"
            style={{ backgroundColor: performanceTone + "18" }}
          >
            <Award size={20} color={performanceTone} />
          </View>
          <View className="flex-1 ml-3">
            <Text
              className="text-sm font-semibold"
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
            style={{ color: performanceTone }}
          >
            {performanceScore}%
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
                width: `${performanceScore}%`,
                backgroundColor: performanceTone,
              }}
            />
          </View>
        </View>
      </TouchableOpacity>

      <View className="mb-4">
        <Text
          className="text-xs uppercase mb-3"
          style={{ color: colors.textSecondary }}
        >
          {t("hod.dashboard.snapshotTitle")}
        </Text>
        <View className="flex-row mb-3" style={{ gap: 10 }}>
          <InfoTile
            label={t("hod.dashboard.cards.activeComplaints")}
            value={Number(activeCount || 0)}
            hint={t("hod.dashboard.cards.totalCases", {
              count: Number(stats?.total || 0),
            })}
            colors={colors}
          />

          <InfoTile
            label={t("hod.dashboard.cards.communitySupport")}
            value={Number(stats?.totalUpvotes || 0)}
            hint={t("hod.dashboard.cards.totalComplaintUpvotes")}
            colors={colors}
          />
        </View>
      </View>
      <View className="mb-4">
        <Text
          className="text-xs uppercase mb-3"
          style={{ color: colors.textSecondary }}
        >
          {t("hod.dashboard.priorityDistribution")}
        </Text>
        <View className="flex-row" style={{ gap: 10 }}>
          <InfoTile
            label={t("complaints.priority.high")}
            value={Number(stats?.highPriority || 0)}
            hint={t("hod.dashboard.priorityHints.urgentCases")}
            colors={colors}
          />
          <InfoTile
            label={t("complaints.priority.medium")}
            value={Number(stats?.mediumPriority || 0)}
            hint={t("hod.dashboard.priorityHints.standardQueue")}
            colors={colors}
          />
          <InfoTile
            label={t("complaints.priority.low")}
            value={Number(stats?.lowPriority || 0)}
            hint={t("hod.dashboard.priorityHints.lowerUrgency")}
            colors={colors}
          />
        </View>
      </View>
      <View className="mb-4">
        <Text
          className="text-xs uppercase mb-3"
          style={{ color: colors.textSecondary }}
        >
          {t("hod.dashboard.workloadFlow")}
        </Text>
        <MetricRow
          icon={AlertTriangle}
          label={t("hod.dashboard.metrics.pendingComplaints")}
          value={Number(stats?.pending || 0)}
          tone={pendingColor}
          colors={colors}
        />
        <MetricRow
          icon={Activity}
          label={t("hod.dashboard.metrics.assignedInProgress")}
          value={activeCount}
          tone={activeColor}
          colors={colors}
        />
        <MetricRow
          icon={Timer}
          label={t("hod.dashboard.awaitingApproval")}
          value={Number(stats?.pendingApproval || 0)}
          tone={approvalColor}
          colors={colors}
        />
        <MetricRow
          icon={CheckCircle}
          label={t("hod.dashboard.metrics.resolvedComplaints")}
          value={Number(stats?.resolved || 0)}
          tone={resolvedColor}
          colors={colors}
        />
        <MetricRow
          icon={AlertTriangle}
          label={t("hod.complaints.needsRework")}
          value={Number(stats?.needsRework || 0)}
          tone={reworkColor}
          colors={colors}
        />
      </View>

      <View
        className="rounded-3xl p-5"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          className="text-xs uppercase mb-3"
          style={{ color: colors.textSecondary }}
        >
          {t("hod.dashboard.signalsTitle")}
        </Text>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Clock size={16} color={colors.info} />
            <Text
              className="text-sm font-semibold ml-2"
              style={{ color: colors.textPrimary }}
            >
              {t("hod.dashboard.performance.responseTimeTitle")}
            </Text>
          </View>
          <Text className="text-sm font-bold" style={{ color: colors.info }}>
            {typeof stats?.avgResponseTime === "number"
              ? `${stats.avgResponseTime.toFixed(1)}h`
              : t("hod.dashboard.noData")}
          </Text>
        </View>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <ThumbsUp size={16} color={colors.primary} />
            <Text
              className="text-sm font-semibold ml-2"
              style={{ color: colors.textPrimary }}
            >
              {t("hod.dashboard.cards.citizenFeedback")}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Star size={15} color={colors.warning} fill={colors.warning} />
            <Text
              className="text-sm font-bold ml-1"
              style={{ color: colors.textPrimary }}
            >
              {stats?.avgFeedbackRating
                ? stats.avgFeedbackRating.toFixed(1)
                : t("hod.dashboard.noData")}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <Users size={16} color={colors.success} />
            <Text
              className="text-sm font-semibold ml-2"
              style={{ color: colors.textPrimary }}
            >
              {t("hod.dashboard.workers.active")}
            </Text>
          </View>
          <Text className="text-sm font-bold" style={{ color: colors.success }}>
            {Number(stats?.activeWorkers || stats?.totalWorkers || 0)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Target
              size={16}
              color={getPriorityColor("High", colors) ?? colors.danger}
            />
            <Text
              className="text-sm font-semibold ml-2"
              style={{ color: colors.textPrimary }}
            >
              {t("hod.dashboard.performance.completionRate")}
            </Text>
          </View>
          <Text
            className="text-sm font-bold"
            style={{ color: colors.textPrimary }}
          >
            {completionRate}%
          </Text>
        </View>
      </View>

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
            <View className="items-center pt-3 pb-1">
              <View
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: colors.border }}
              />
            </View>

            <View className="flex-row items-center justify-between px-5 pt-3 pb-4">
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: performanceTone + "20" }}
                >
                  <Award size={20} color={performanceTone} />
                </View>
                <Text
                  className="text-lg font-bold ml-3"
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
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              <View className="mx-5 mb-4 rounded-2xl overflow-hidden">
                <View
                  className="px-5 py-4"
                  style={{ backgroundColor: performanceTone + "18" }}
                >
                  <Text
                    className="text-xs font-semibold uppercase mb-1"
                    style={{ color: performanceTone }}
                  >
                    {t("hod.dashboard.performance.currentScore")}
                  </Text>
                  <View className="flex-row items-end">
                    <Text
                      className="text-5xl font-bold"
                      style={{ color: performanceTone }}
                    >
                      {performanceScore}
                    </Text>
                    <Text
                      className="text-2xl font-bold mb-1 ml-1"
                      style={{ color: performanceTone + "80" }}
                    >
                      %
                    </Text>
                  </View>
                  <View
                    className="h-2 rounded-full mt-3 overflow-hidden"
                    style={{ backgroundColor: performanceTone + "30" }}
                  >
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${performanceScore}%`,
                        backgroundColor: performanceTone,
                      }}
                    />
                  </View>
                </View>
              </View>

              <View className="mx-5 mb-3">
                <Text
                  className="text-xs font-semibold uppercase mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  {t("hod.dashboard.performance.calculationFormula")}
                </Text>
                <View
                  className="rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    className="text-sm"
                    style={{ color: colors.textPrimary, lineHeight: 22 }}
                  >
                    {t("hod.dashboard.performance.formulaText")}
                  </Text>
                </View>
              </View>

              <View className="mx-5 mb-4">
                <MetricRow
                  icon={CheckCircle}
                  label={t("hod.dashboard.performance.completionRateTitle")}
                  value={`${completionRate}%`}
                  tone={colors.success}
                  colors={colors}
                />
                <MetricRow
                  icon={Timer}
                  label={t("hod.dashboard.performance.responseTimeTitle")}
                  value={`${responseScore}%`}
                  tone={colors.warning}
                  colors={colors}
                />
                <MetricRow
                  icon={AlertTriangle}
                  label={t("hod.dashboard.performance.pendingStatusTitle")}
                  value={`${pendingScore}%`}
                  tone={colors.danger}
                  colors={colors}
                />
              </View>

              <View className="mx-5 mb-2">
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
    </ScrollView>
  );
}
