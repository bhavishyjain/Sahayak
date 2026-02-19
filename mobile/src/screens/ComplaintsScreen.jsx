import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import ScreenShell from "../components/ScreenShell";
import SurfaceCard from "../components/SurfaceCard";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";
import { statusColor } from "../utils/status";

export default function ComplaintsScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { theme } = usePreferences();
  const colors = useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    const data = await api.myComplaints(token);
    setItems(data.complaints || []);
  }, [token]);

  useFocusEffect(useCallback(() => { load().catch(() => {}); }, [load]));

  return (
    <ScreenShell scroll={false}>
      <Text className="mt-3 mb-1 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>{t("myComplaints")}</Text>
      <Text className="mb-4 text-sm" style={{ color: colors.textSecondary }}>Track status and timelines in one place</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>{t("noComplaints")}</Text>}
        renderItem={({ item }) => (
          <SurfaceCard className="mb-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>{item.title}</Text>
              <View className="rounded-full px-3 py-1" style={{ backgroundColor: `${statusColor(item.status)}20` }}>
                <Text className="text-xs font-semibold" style={{ color: statusColor(item.status) }}>{item.status}</Text>
              </View>
            </View>
            <Text className="mt-1 text-xs" style={{ color: colors.textSecondary }}>{item.ticketId}</Text>
            <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }} numberOfLines={2}>{item.description}</Text>
          </SurfaceCard>
        )}
      />
    </ScreenShell>
  );
}
