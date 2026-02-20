import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { api } from "../../../api/client";
import Card from "../../../components/Card";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";
import { statusColor } from "../../../utils/status";

export default function ComplaintsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { token } = useAuth();
  const { theme } = usePreferences();
  const colors = useMemo(
    () => (theme === "dark" ? darkColors : lightColors),
    [theme],
  );
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    const data = await api.myComplaints(token);
    setItems(data.complaints || []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
        paddingHorizontal: 16,
      }}
    >
      <View className="mb-2 mt-1 flex-row items-center py-2">
        <Pressable
          onPress={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : navigation.navigate("MainTabs")
          }
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.backgroundSecondary }}
        >
          <Text
            style={{ color: colors.textPrimary, fontSize: 20, marginTop: -2 }}
          >
            {"<"}
          </Text>
        </Pressable>
        <Text
          className="flex-1 text-center text-lg font-bold"
          style={{ color: colors.textPrimary }}
        >
          {t("complaints")}
        </Text>
        <View className="h-10 w-10" />
      </View>
      <Text
        className="mb-1 text-3xl font-extrabold"
        style={{ color: colors.textPrimary }}
      >
        {t("myComplaints")}
      </Text>
      <Text className="mb-4 text-sm" style={{ color: colors.textSecondary }}>
        Track status and timelines in one place
      </Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary }}>
            {t("noComplaints")}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("ComplaintDetail", { item })}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <Card className="mb-3">
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  {item.title}
                </Text>
                <View
                  className="rounded-full px-3 py-1"
                  style={{ backgroundColor: `${statusColor(item.status)}20` }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: statusColor(item.status) }}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text
                className="mt-1 text-xs"
                style={{ color: colors.textSecondary }}
              >
                {item.ticketId}
              </Text>
              <Text
                className="mt-2 text-sm"
                style={{ color: colors.textSecondary }}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
