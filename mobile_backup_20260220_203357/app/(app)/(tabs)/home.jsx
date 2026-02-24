import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { ArrowRight, ClipboardList, Clock3, ShieldCheck, Sparkles, Timer } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { api } from "../../../api/client";
import Card from "../../../components/Card";
import InfoCard from "../../../components/InfoCard";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";
import { statusColor } from "../../../utils/status";

function StatCard({ label, value, icon: Icon, iconColor, colors }) {
  return (
    <Card className="w-[48%] p-3.5" style={{ borderWidth: 1, borderColor: colors.border }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] uppercase tracking-wide" style={{ color: colors.textSecondary }}>
          {label}
        </Text>
        <View
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: `${iconColor}22` }}
        >
          <Icon size={16} color={iconColor} />
        </View>
      </View>
      <Text className="mt-2 text-[28px] font-extrabold" style={{ color: colors.textPrimary }}>
        {value}
      </Text>
    </Card>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
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

  const firstName = user?.fullName?.split(" ")?.[0] || "Citizen";
  const recent = summary?.recent || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 34 }}>
        <View className="mt-4 mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-[13px]" style={{ color: colors.textSecondary }}>
              {t("dashboard")}
            </Text>
            <Text className="text-[30px] font-extrabold" style={{ color: colors.textPrimary }}>
              {firstName}
            </Text>
          </View>
          <View
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }}
          >
            <Sparkles size={20} color={colors.primary} />
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/(app)/(tabs)/complaints")}
          style={{ borderRadius: 18, overflow: "hidden", marginTop: 6 }}
        >
          <View
            style={{
              minHeight: 188,
              backgroundColor: colors.backgroundCard,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 18,
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>
                {t("dashboard").toUpperCase()}
              </Text>
              <Text style={{ color: colors.textPrimary, fontSize: 30, fontWeight: "800", marginTop: 4 }}>
                {t("myComplaints")}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                {`${t("myComplaints")}: ${summary?.stats?.total ?? 0}`}
              </Text>
              <View className="mt-4 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: `${colors.primary}25` }}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>
                  Quick overview
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <View
                className="flex-row items-center rounded-xl px-3 py-2"
                style={{ backgroundColor: colors.primary }}
              >
                <ClipboardList size={16} color={colors.dark} />
                <Text style={{ color: colors.dark, fontSize: 13, fontWeight: "800", marginLeft: 7 }}>
                  {t("myComplaints")}
                </Text>
              </View>
              <ArrowRight size={20} color={colors.textSecondary} />
            </View>
          </View>
        </Pressable>

        <View className="mt-4 flex-row flex-wrap justify-between gap-y-3">
          <StatCard
            label={t("total")}
            value={summary?.stats?.total ?? 0}
            icon={ClipboardList}
            iconColor={colors.primary}
            colors={colors}
          />
          <StatCard
            label={t("pending")}
            value={summary?.stats?.pending ?? 0}
            icon={Clock3}
            iconColor={colors.warning}
            colors={colors}
          />
          <StatCard
            label={t("inProgress")}
            value={summary?.stats?.inProgress ?? 0}
            icon={Timer}
            iconColor={colors.info}
            colors={colors}
          />
          <StatCard
            label={t("resolved")}
            value={summary?.stats?.resolved ?? 0}
            icon={ShieldCheck}
            iconColor={colors.success}
            colors={colors}
          />
        </View>

        <Card className="mt-3" style={{ borderWidth: 1, borderColor: colors.border }}>
          <InfoCard
            label={t("pending")}
            value={summary?.stats?.pending ?? 0}
            icon={Clock3}
            iconColor={colors.warning}
          />
          <InfoCard
            label={t("inProgress")}
            value={summary?.stats?.inProgress ?? 0}
            icon={Timer}
            iconColor={colors.info}
          />
          <InfoCard
            label={t("resolved")}
            value={summary?.stats?.resolved ?? 0}
            icon={ShieldCheck}
            iconColor={colors.success}
            isLast
          />
        </Card>

        <View className="mt-7 mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-semibold" style={{ color: colors.textPrimary }}>
            {t("myComplaints")}
          </Text>
          <Pressable onPress={() => router.push("/(app)/(tabs)/complaints")}>
            <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
              View all
            </Text>
          </Pressable>
        </View>

        {!recent.length ? (
          <Card className="mb-2" style={{ borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
              No recent complaints
            </Text>
            <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
              Register a new complaint to see updates here.
            </Text>
          </Card>
        ) : (
          recent.map((item) => (
            <Card key={item.id} className="mb-3" style={{ borderWidth: 1, borderColor: colors.border }}>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                    {item.title}
                  </Text>
                  <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                    {item.ticketId}
                  </Text>
                  {!!item.locationName && (
                    <Text className="mt-2 text-[12px]" style={{ color: colors.textSecondary }}>
                      {item.locationName}
                    </Text>
                  )}
                </View>
                <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${statusColor(item.status)}20` }}>
                  <Text className="text-xs font-semibold" style={{ color: statusColor(item.status) }}>
                    {item.status}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
