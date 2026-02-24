import { Tabs } from "expo-router";
import { Flame, Grid2x2, Mic, PlusCircle, Settings } from "lucide-react-native";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import CurvedTabBar from "../../../components/CurvedTabBar";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";

const TAB_BAR_HEIGHT = 74;
const TAB_BAR_BOTTOM_OFFSET = 16;
const TAB_BAR_WIDTH = "95%";
const SCREEN_BOTTOM_INSET = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_OFFSET + 24;

export default function TabsLayout() {
  const { t } = useTranslation();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { paddingBottom: SCREEN_BOTTOM_INSET },
        tabBarStyle: {
          position: "absolute",
          bottom: TAB_BAR_BOTTOM_OFFSET,
          alignSelf: "center",
          width: TAB_BAR_WIDTH,
          height: TAB_BAR_HEIGHT,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarBackground: () => (
          <CurvedTabBar colors={colors} height={TAB_BAR_HEIGHT} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            home: Grid2x2,
            chat: Mic,
            "complaint-register": PlusCircle,
            heatmap: Flame,
            settings: Settings,
          };
          const Icon = iconMap[route.name] || Grid2x2;
          return <Icon size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: t("dashboard") }} />
      <Tabs.Screen name="heatmap" options={{ title: t("heatmap") }} />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("chat"),
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: ({ onPress, accessibilityState }) => {
            const focused = Boolean(accessibilityState?.selected);
            return (
              <Pressable
                onPress={onPress}
                style={{
                  top: -24,
                  width: 62,
                  height: 62,
                  borderRadius: 31,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.primary,
                  borderWidth: 4,
                  borderColor: colors.backgroundPrimary,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 10,
                }}
              >
                <Mic size={28} color={focused ? colors.dark : "#111111"} />
              </Pressable>
            );
          },
        }}
      />
      <Tabs.Screen
        name="complaint-register"
        options={{ title: t("newComplaint") }}
      />
      <Tabs.Screen name="settings" options={{ title: t("settings") }} />

      <Tabs.Screen name="complaints" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
    </Tabs>
  );
}
