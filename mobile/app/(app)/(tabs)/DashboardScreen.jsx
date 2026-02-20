import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { ClipboardList } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { api } from "../../../api/client";
import Card from "../../../components/Card";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";
import { statusColor } from "../../../utils/status";

function StatCard({ label, value, colors }) {
  return (
    <Card className="w-[48%] p-3.5">
      <Text className="text-[11px] uppercase tracking-wide" style={{ color: colors.textSecondary }}>{label}</Text>
      <Text className="mt-1 text-2xl font-extrabold" style={{ color: colors.textPrimary }}>{value}</Text>
    </Card>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Pressable onPress={() => navigation.navigate("ComplaintsList")} style={{ borderRadius: 14, overflow: "hidden", marginTop: 12 }}>
          <View style={{ minHeight: 200, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border, padding: 18, justifyContent: "space-between" }}>
            <View>
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>
                {t("dashboard").toUpperCase()}
              </Text>
              <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: "800", marginTop: 4 }}>
                {user?.fullName?.split(" ")?.[0] || "Sahayak"}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {`${t("myComplaints")}: ${summary?.stats?.total ?? 0}`}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <View style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12 }}>
                <Text style={{ color: colors.dark, fontSize: 13, fontWeight: "700" }}>{t("myComplaints")}</Text>
              </View>
              <ClipboardList size={30} color={colors.primary} />
            </View>
          </View>
        </Pressable>

        <View className="mt-4 flex-row flex-wrap justify-between gap-y-3">
          <StatCard label={t("total")} value={summary?.stats?.total ?? 0} colors={colors} />
          <StatCard label={t("pending")} value={summary?.stats?.pending ?? 0} colors={colors} />
          <StatCard label={t("inProgress")} value={summary?.stats?.inProgress ?? 0} colors={colors} />
          <StatCard label={t("resolved")} value={summary?.stats?.resolved ?? 0} colors={colors} />
        </View>

        <Text className="mt-7 mb-3 text-lg font-semibold" style={{ color: colors.textPrimary }}>{t("myComplaints")}</Text>
        {(summary?.recent || []).map((item) => (
          <Card key={item.id} className="mb-3">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>{item.title}</Text>
                <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>{item.ticketId}</Text>
              </View>
              <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${statusColor(item.status)}20` }}>
                <Text className="text-xs font-semibold" style={{ color: statusColor(item.status) }}>{item.status}</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
