import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import HeroStatusCard from "../components/HeroStatusCard";
import ScreenShell from "../components/ScreenShell";
import SurfaceCard from "../components/SurfaceCard";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";
import { statusColor } from "../utils/status";

function StatCard({ label, value, colors }) {
  return (
    <SurfaceCard className="w-[48%] p-3.5">
      <Text className="text-[11px] uppercase tracking-wide" style={{ color: colors.textSecondary }}>{label}</Text>
      <Text className="mt-1 text-2xl font-extrabold" style={{ color: colors.textPrimary }}>{value}</Text>
    </SurfaceCard>
  );
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { theme } = usePreferences();
  const colors = useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    const data = await api.dashboardSummary(token);
    setSummary(data);
  }, [token]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  return (
    <ScreenShell>
      <HeroStatusCard
        statusLabel={t("dashboard").toUpperCase()}
        title={user?.fullName?.split(" ")?.[0] || "Sahayak"}
        subtitle={`${t("myComplaints")}: ${summary?.stats?.total ?? 0}`}
        actionLabel={t("newComplaint")}
        onPress={() => {}}
      />

      <View className="mt-4 flex-row flex-wrap justify-between gap-y-3">
        <StatCard label={t("total")} value={summary?.stats?.total ?? 0} colors={colors} />
        <StatCard label={t("pending")} value={summary?.stats?.pending ?? 0} colors={colors} />
        <StatCard label={t("inProgress")} value={summary?.stats?.inProgress ?? 0} colors={colors} />
        <StatCard label={t("resolved")} value={summary?.stats?.resolved ?? 0} colors={colors} />
      </View>

      <Text className="mt-7 mb-3 text-lg font-semibold" style={{ color: colors.textPrimary }}>{t("myComplaints")}</Text>
      {(summary?.recent || []).map((item) => (
        <SurfaceCard key={item.id} className="mb-3">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>{item.title}</Text>
              <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>{item.ticketId}</Text>
            </View>
            <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${statusColor(item.status)}20` }}>
              <Text className="text-xs font-semibold" style={{ color: statusColor(item.status) }}>{item.status}</Text>
            </View>
          </View>
        </SurfaceCard>
      ))}
    </ScreenShell>
  );
}
