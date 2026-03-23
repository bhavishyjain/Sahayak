import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Building2,
  ChevronRight,
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

export default function AdminHomeTab() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const [user, setUser] = useState(null);
  const { departments } = useDepartments({ includeInactive: true });

  useEffect(() => {
    getUserAuth().then(setUser).catch(() => {});
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    if (hour < 21) return "Good evening";
    return "Good night";
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
      const departments = Object.values(departmentsRes?.data ?? {})
        .filter((item) => item?.department)
        .map((item) => ({
          department: item.department,
          total: Number(item.total ?? 0),
          pending: Number(item.pending ?? 0),
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
      text1: "Could not load admin dashboard",
      text2: error?.response?.data?.message || "Please try again.",
    });
  }, [error]);

  const resolvedCount = Number(data?.stats?.byStatus?.resolved ?? 0);
  const totalCount = Number(data?.stats?.total ?? 0);
  const departmentCount = useMemo(() => departments.length, [departments]);

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
          {user?.fullName || "Admin Dashboard"}
        </Text>
      </View>

      <View className="flex-row mb-3" style={{ gap: 12 }}>
        <StatTile
          label="Total complaints"
          value={totalCount}
          subtitle={`${resolvedCount} resolved complaints`}
          tone={colors.textPrimary}
          colors={colors}
        />
        <StatTile
          label="Deleted"
          value={data?.counts?.deletedComplaints ?? 0}
          tone={colors.danger}
          colors={colors}
        />
      </View>

      <View className="flex-row mb-5" style={{ gap: 12 }}>
        <StatTile
          label="Workers"
          value={data?.counts?.workers ?? 0}
          subtitle={`${data?.counts?.inactiveWorkers ?? 0} inactive`}
          tone={colors.primary}
          colors={colors}
        />
        <StatTile
          label="Department heads"
          value={data?.counts?.heads ?? 0}
          subtitle={`${data?.counts?.inactiveHeads ?? 0} inactive`}
          tone={colors.warning}
          colors={colors}
        />
      </View>

      <SummaryRow
        icon={Building2}
        label="Departments"
        value={departmentCount}
        tone={colors.primary}
        onPress={() => router.push("/(app)/(tabs)/admin-departments")}
        colors={colors}
      />
    </ScrollView>
  );
}
