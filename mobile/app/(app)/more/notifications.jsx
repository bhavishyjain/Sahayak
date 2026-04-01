import {
  FileText,
  FolderOpen,
  Trash2,
  TriangleAlert,
  UserCheck,
  Wrench,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import {
  useNotificationActions,
  useNotificationPreferences,
} from "../../../utils/hooks/useNotifications";

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
  {
    key: "specialRequests",
    labelKey: "more.notificationsScreen.preferences.specialRequests.label",
    subKey: "more.notificationsScreen.preferences.specialRequests.sub",
    Icon: FolderOpen,
  },
  {
    key: "deletedComplaints",
    labelKey: "more.notificationsScreen.preferences.deletedComplaints.label",
    subKey: "more.notificationsScreen.preferences.deletedComplaints.sub",
    Icon: Trash2,
  },
];

const TOGGLE_WIDTH = 52;
const TOGGLE_HEIGHT = 30;
const KNOB_SIZE = 24;
const TOGGLE_PADDING = 3;
const KNOB_TRAVEL = TOGGLE_WIDTH - KNOB_SIZE - TOGGLE_PADDING * 2;

function PreferenceToggle({ checked, loading, onPress, toneColor, colors }) {
  const translateX = useRef(new Animated.Value(checked ? KNOB_TRAVEL : 0)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: checked ? KNOB_TRAVEL : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [checked, translateX]);

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(checked), disabled: Boolean(loading) }}
      className="rounded-full justify-center"
      style={{
        width: TOGGLE_WIDTH,
        height: TOGGLE_HEIGHT,
        paddingHorizontal: TOGGLE_PADDING,
        backgroundColor: checked ? toneColor : colors.border,
        opacity: loading ? 0.85 : 1,
      }}
    >
      <Animated.View
        className="rounded-full items-center justify-center"
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          backgroundColor: colors.light,
          transform: [{ translateX }],
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color={toneColor} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

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
      if (key === "escalations") return colors.danger;
      if (key === "specialRequests") return colors.warning;
      if (key === "deletedComplaints") return colors.secondary;
      return colors.secondary;
    },
    [colors],
  );

  const [savingPref, setSavingPref] = useState(null);
  const {
    data: preferenceData,
    isLoading: loadingPreferences,
    isRefetching: refreshing,
    refetch,
  } = useNotificationPreferences();
  const { updatePreferences } = useNotificationActions();
  const allowedKeys = Array.isArray(preferenceData?.allowedKeys)
    ? preferenceData.allowedKeys
    : PREF_ROWS.map((item) => item.key);
  const visibleRows = PREF_ROWS.filter((item) => allowedKeys.includes(item.key));
  const preferences = {
    complaintsUpdates: true,
    assignments: true,
    escalations: true,
    systemAlerts: true,
    specialRequests: true,
    deletedComplaints: true,
    ...((preferenceData && preferenceData.preferences) || {}),
  };

  const handleToggle = useCallback(
    async (key, value) => {
      setSavingPref(key);
      try {
        await updatePreferences({ [key]: value });
      } finally {
        setSavingPref(null);
      }
    },
    [updatePreferences],
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("more.notificationsScreen.title")} />

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
              onRefresh={() => refetch()}
              tintColor={colors.textSecondary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {visibleRows.map(({ key, labelKey, subKey, Icon }, idx) => {
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
                    <PreferenceToggle
                      checked={Boolean(preferences[key])}
                      loading={savingPref === key}
                      toneColor={toneColor}
                      colors={colors}
                      onPress={() => handleToggle(key, !preferences[key])}
                    />
                  </View>
                  {idx < visibleRows.length - 1 && (
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
