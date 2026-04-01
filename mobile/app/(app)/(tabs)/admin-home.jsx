import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Activity,
  Building2,
  ChevronRight,
  Clock3,
  ShieldCheck,
  TrendingUp,
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
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";
import apiCall from "../../../utils/api";
import useDepartments from "../../../utils/hooks/useDepartments";
import {
  DELETED_COMPLAINTS_URL,
  REPORT_DEPARTMENT_BREAKDOWN_URL,
  REPORT_STATS_URL,
  USERS_URL,
} from "../../../url";

function StatTile({ label, value, subtitle, tone, colors }) {
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
        className="text-2xl font-bold mt-2"
        style={{ color: tone || colors.textPrimary }}
      >
        {value}
      </Text>
      {subtitle ? (
        <Text className="text-xs mt-1.5" style={{ color: colors.textSecondary }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function SummaryRow({ icon: Icon, label, value, tone, onPress, colors }) {
  const content = (
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
        <View className="flex-row items-center">
          <Text className="text-xl font-bold mr-2" style={{ color: tone }}>
            {value}
          </Text>
          {onPress ? <ChevronRight size={18} color={colors.textSecondary} /> : null}
        </View>
      </View>
    </View>
  );

  if (!onPress) return content;

  const PressableBlock = require("../../../components/PressableBlock").default;
  return <PressableBlock onPress={onPress}>{content}</PressableBlock>;
}

function InsightCard({ title, value, helper, tone, icon: Icon, colors }) {
  return (
    <View
      className="flex-1 rounded-2xl p-4"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        className="w-10 h-10 rounded-2xl items-center justify-center mb-3"
        style={{ backgroundColor: tone + "18" }}
      >
        <Icon size={18} color={tone} />
      </View>
      <Text className="text-xs" style={{ color: colors.textSecondary }}>
        {title}
      </Text>
      <Text
        className="text-2xl font-bold mt-2"
        style={{ color: tone || colors.textPrimary }}
      >
        {value}
      </Text>
      <Text className="text-xs mt-1.5" style={{ color: colors.textSecondary }}>
        {helper}
      </Text>
    </View>
  );
}

function StatusPill({ label, value, tone, colors }) {
  return (
    <View
      className="rounded-xl px-3 py-3"
      style={{
        backgroundColor: colors.backgroundPrimary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text className="text-[11px]" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      <Text className="text-base font-semibold mt-1" style={{ color: tone }}>
        {value}
      </Text>
    </View>
  );
}

export default function AdminHomeTab() {
  const { colorScheme } = useTheme();
  const { t } = useTranslation();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const [user, setUser] = useState(null);
  const { departments } = useDepartments({ includeInactive: true });

  useEffect(() => {
    getUserAuth().then(setUser).catch(() => {});
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("adminScreens.home.greeting.morning");
    if (hour < 17) return t("adminScreens.home.greeting.afternoon");
    if (hour < 21) return t("adminScreens.home.greeting.evening");
    return t("adminScreens.home.greeting.night");
  };

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ["admin-dashboard-home"],
    queryFn: async () => {
      const [statsRes, departmentsRes, usersRes, deletedRes] = await Promise.all([
        apiCall({ method: "GET", url: REPORT_STATS_URL }),
        apiCall({ method: "GET", url: REPORT_DEPARTMENT_BREAKDOWN_URL }),
        apiCall({ method: "GET", url: `${USERS_URL}?includeStats=true` }),
        apiCall({ method: "GET", url: `${DELETED_COMPLAINTS_URL}?page=1&limit=1` }),
      ]);

      const users = usersRes?.data ?? [];
      const workers = users.filter((item) => item.role === "worker");
      const heads = users.filter((item) => item.role === "head");
      const breakdownSource =
        departmentsRes?.data?.breakdown ||
        departmentsRes?.data?.summary ||
        departmentsRes?.data ||
        {};
      const departments = Object.entries(breakdownSource)
        .filter(([key, item]) => key && item && typeof item === "object")
        .map(([departmentName, item]) => ({
          department: departmentName,
          total: Number(item.total ?? 0),
          pending: Number(item.pending ?? 0),
          assigned: Number(item.assigned ?? 0),
          inProgress: Number(item.inProgress ?? 0),
          pendingApproval: Number(item.pendingApproval ?? 0),
          resolved: Number(item.resolved ?? 0),
        }))
        .sort((left, right) => right.total - left.total)
        .slice(0, 5);

      return {
        stats: statsRes?.data?.stats ?? {},
        counts: {
          workers: workers.length,
          heads: heads.length,
          inactiveWorkers: workers.filter((item) => item.isActive === false).length,
          inactiveHeads: heads.filter((item) => item.isActive === false).length,
          deletedComplaints: Number(deletedRes?.data?.total ?? 0),
        },
        departments,
      };
    },
  });

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("adminScreens.home.toasts.loadFailedTitle"),
      text2:
        error?.response?.data?.message ||
        t("adminScreens.home.toasts.loadFailedMessage"),
    });
  }, [error, t]);

  const resolvedCount = Number(data?.stats?.byStatus?.resolved ?? 0);
  const totalCount = Number(data?.stats?.total ?? 0);
  const pendingCount = Number(data?.stats?.byStatus?.pending ?? 0);
  const assignedCount = Number(data?.stats?.byStatus?.assigned ?? 0);
  const inProgressCount = Number(
    data?.stats?.byStatus?.["in-progress"] ??
      data?.stats?.byStatus?.inProgress ??
      0,
  );
  const pendingApprovalCount = Number(
    data?.stats?.byStatus?.["pending-approval"] ??
      data?.stats?.byStatus?.pendingApproval ??
      0,
  );
  const avgResolutionTime = Number(data?.stats?.avgResolutionTime ?? 0);
  const departmentCount = useMemo(() => departments.length, [departments]);
  const activeWorkers =
    Number(data?.counts?.workers ?? 0) -
    Number(data?.counts?.inactiveWorkers ?? 0);
  const activeHeads =
    Number(data?.counts?.heads ?? 0) -
    Number(data?.counts?.inactiveHeads ?? 0);
  const activeTeam = activeWorkers + activeHeads;
  const inactiveTeam =
    Number(data?.counts?.inactiveWorkers ?? 0) +
    Number(data?.counts?.inactiveHeads ?? 0);
  const resolutionRate = totalCount
    ? `${Math.round((resolvedCount / totalCount) * 100)}%`
    : "0%";
  const busiestDepartment = data?.departments?.[0] ?? null;

  if (isLoading) {
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
          refreshing={isRefetching}
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
          {user?.fullName || t("adminScreens.home.defaultTitle")}
        </Text>
        <Text className="text-sm mt-2" style={{ color: colors.textSecondary }}>
          {t("adminScreens.home.subtitle")}
        </Text>
      </View>

      <View
        className="rounded-3xl p-5 mb-4"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text className="text-xs uppercase" style={{ color: colors.textSecondary }}>
          {t("adminScreens.home.systemOverview")}
        </Text>
        <Text
          className="text-3xl font-extrabold mt-2"
          style={{ color: colors.textPrimary }}
        >
          {totalCount}
        </Text>
        <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>
          {t("adminScreens.home.totalComplaintsHelper", {
            count: departmentCount,
          })}
        </Text>

        <View className="flex-row mt-4" style={{ gap: 12 }}>
          <View
            className="flex-1 rounded-2xl p-3"
            style={{ backgroundColor: colors.backgroundPrimary }}
          >
            <Text className="text-[11px]" style={{ color: colors.textSecondary }}>
              {t("adminScreens.home.resolutionRate")}
            </Text>
            <Text className="text-lg font-bold mt-1" style={{ color: colors.success }}>
              {resolutionRate}
            </Text>
          </View>
          <View
            className="flex-1 rounded-2xl p-3"
            style={{ backgroundColor: colors.backgroundPrimary }}
          >
            <Text className="text-[11px]" style={{ color: colors.textSecondary }}>
              {t("adminScreens.home.avgResolution")}
            </Text>
            <Text className="text-lg font-bold mt-1" style={{ color: colors.primary }}>
              {avgResolutionTime ? `${avgResolutionTime}h` : "-"}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row mb-4" style={{ gap: 12 }}>
        <InsightCard
          title={t("adminScreens.home.activeTeam")}
          value={activeTeam}
          helper={t("adminScreens.home.inactiveMembers", {
            count: inactiveTeam,
          })}
          tone={colors.primary}
          icon={Users}
          colors={colors}
        />
        <InsightCard
          title={t("adminScreens.home.deletedComplaints")}
          value={data?.counts?.deletedComplaints ?? 0}
          helper={t("adminScreens.home.deletedComplaintsHelper")}
          tone={colors.danger}
          icon={ShieldCheck}
          colors={colors}
        />
      </View>

      <View
        className="rounded-2xl p-4 mb-4"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            {t("adminScreens.home.complaintStatus")}
          </Text>
          <Activity size={16} color={colors.textSecondary} />
        </View>

        <View className="flex-row mb-3" style={{ gap: 10 }}>
          <View className="flex-1">
            <StatusPill
              label={t("common.status.pending")}
              value={pendingCount}
              tone={colors.warning}
              colors={colors}
            />
          </View>
          <View className="flex-1">
            <StatusPill
              label={t("common.status.assigned")}
              value={assignedCount}
              tone={colors.primary}
              colors={colors}
            />
          </View>
        </View>

        <View className="flex-row" style={{ gap: 10 }}>
          <View className="flex-1">
            <StatusPill
              label={t("common.status.inProgress")}
              value={inProgressCount}
              tone={colors.info}
              colors={colors}
            />
          </View>
          <View className="flex-1">
            <StatusPill
              label={t("common.status.pendingApproval")}
              value={pendingApprovalCount}
              tone={colors.warning}
              colors={colors}
            />
          </View>
        </View>
      </View>

      <View className="flex-row mb-4" style={{ gap: 12 }}>
        <StatTile
          label={t("adminScreens.home.workers")}
          value={data?.counts?.workers ?? 0}
          subtitle={t("adminScreens.home.inactiveShort", {
            count: data?.counts?.inactiveWorkers ?? 0,
          })}
          tone={colors.primary}
          colors={colors}
        />
        <StatTile
          label={t("adminScreens.home.departmentHeads")}
          value={data?.counts?.heads ?? 0}
          subtitle={t("adminScreens.home.inactiveShort", {
            count: data?.counts?.inactiveHeads ?? 0,
          })}
          tone={colors.warning}
          colors={colors}
        />
      </View>

      <SummaryRow
        icon={Building2}
        label={t("adminScreens.home.departments")}
        value={departmentCount}
        tone={colors.primary}
        onPress={() => router.push("/(app)/(tabs)/admin-departments")}
        colors={colors}
      />

      <View
        className="rounded-2xl p-4"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
            {t("adminScreens.home.operationalInsight")}
          </Text>
          <TrendingUp size={16} color={colors.textSecondary} />
        </View>

        <View
          className="rounded-xl p-4 mb-3"
          style={{ backgroundColor: colors.backgroundPrimary }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {t("adminScreens.home.busiestDepartment")}
            </Text>
            <Clock3 size={15} color={colors.textSecondary} />
          </View>
          <Text className="text-lg font-semibold mt-2" style={{ color: colors.textPrimary }}>
            {busiestDepartment?.department || t("adminScreens.home.noDepartmentData")}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            {busiestDepartment
              ? t("adminScreens.home.busiestSummary", {
                  total: busiestDepartment.total,
                  pending: busiestDepartment.pending,
                  inProgress: busiestDepartment.inProgress,
                })
              : t("adminScreens.home.noDepartmentDataHelper")}
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}
