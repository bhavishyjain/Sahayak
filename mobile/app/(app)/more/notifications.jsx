import { useFocusEffect } from "expo-router";
import {
  FileText,
  TriangleAlert,
  UserCheck,
  Wrench,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import { NOTIFICATION_PREFERENCES_URL } from "../../../url";

const PREF_ROWS = [
  {
    key: "complaintsUpdates",
    labelKey: "more.notificationsScreen.preferences.complaintsUpdates.label",
    subKey: "more.notificationsScreen.preferences.complaintsUpdates.sub",
    Icon: FileText,
  },
  {
    key: "assignments",
    labelKey: "more.notificationsScreen.preferences.assignments.label",
    subKey: "more.notificationsScreen.preferences.assignments.sub",
    Icon: UserCheck,
  },
  {
    key: "escalations",
    labelKey: "more.notificationsScreen.preferences.escalations.label",
    subKey: "more.notificationsScreen.preferences.escalations.sub",
    Icon: TriangleAlert,
  },
  {
    key: "systemAlerts",
    labelKey: "more.notificationsScreen.preferences.systemAlerts.label",
    subKey: "more.notificationsScreen.preferences.systemAlerts.sub",
    Icon: Wrench,
  },
];

export default function NotificationsScreen() {
  const { colorScheme } = useTheme();
  const { t } = useTranslation();
  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );

  const getPreferenceColor = useCallback(
    (key) => {
      if (key === "complaintsUpdates") return colors.info;
      if (key === "assignments") return colors.primary;
      if (key === "escalations") return colors.error;
      return colors.secondary;
    },
    [colors],
  );

  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preferences, setPreferences] = useState({
    complaintsUpdates: true,
    assignments: true,
    escalations: true,
    systemAlerts: true,
  });
  const [savingPref, setSavingPref] = useState(null);

  const loadPreferences = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadingPreferences(true);
    }

    try {
      const res = await apiCall({
        method: "GET",
        url: NOTIFICATION_PREFERENCES_URL,
      });
      const payload = res.data;
      setPreferences((prev) => ({ ...prev, ...payload.preferences }));
    } catch {
      /* silently fail */
    } finally {
      setLoadingPreferences(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPreferences(false);
    }, [loadPreferences]),
  );

  const handleToggle = useCallback(
    async (key, value) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
      setSavingPref(key);
      try {
        const res = await apiCall({
          method: "PUT",
          url: NOTIFICATION_PREFERENCES_URL,
          data: { [key]: value },
        });
        const payload = res.data;
        setPreferences((prev) => ({ ...prev, ...payload.preferences }));
      } catch {
        setPreferences((prev) => ({ ...prev, [key]: !value }));
        Toast.show({
          type: "error",
          text1: t("more.notificationsScreen.toasts.savePreferenceFailed"),
        });
      } finally {
        setSavingPref(null);
      }
    },
    [t],
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("more.menu.notifications.title")} />

      {loadingPreferences ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadPreferences(true)}
              tintColor={colors.textSecondary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text
            className="text-xs font-semibold uppercase mb-3"
            style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
          >
            {t("more.notificationsScreen.preferences.title")}
          </Text>

          <View
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {PREF_ROWS.map(({ key, labelKey, subKey, Icon }, idx) => {
              const toneColor = getPreferenceColor(key);

              return (
                <View key={key}>
                  <View className="flex-row items-center px-4 py-3.5">
                    <View
                      className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                      style={{ backgroundColor: toneColor + "20" }}
                    >
                      <Icon size={16} color={toneColor} />
                    </View>
                    <View className="flex-1 mr-3">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.textPrimary }}
                      >
                        {t(labelKey)}
                      </Text>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: colors.textSecondary }}
                      >
                        {t(subKey)}
                      </Text>
                    </View>
                    {savingPref === key ? (
                      <ActivityIndicator size="small" color={toneColor} />
                    ) : (
                      <Switch
                        value={preferences[key]}
                        onValueChange={(val) => handleToggle(key, val)}
                        trackColor={{ false: colors.border, true: toneColor }}
                        thumbColor={colors.light}
                      />
                    )}
                  </View>
                  {idx < PREF_ROWS.length - 1 && (
                    <View
                      className="h-[1px] ml-14"
                      style={{ backgroundColor: colors.border }}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
