import { Flame, Grid2x2, Mic, PlusCircle, Settings } from "lucide-react-native";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import CurvedTabBar from "../components/CurvedTabBar";
import ChatScreen from "../app/(app)/(tabs)/ChatScreen";
import ComplaintDetailScreen from "../app/(app)/(tabs)/ComplaintDetailScreen";
import ComplaintsScreen from "../app/(app)/(tabs)/ComplaintsScreen";
import DashboardScreen from "../app/(app)/(tabs)/DashboardScreen";
import EditProfileScreen from "../app/(app)/(tabs)/EditProfileScreen";
import HeatmapScreen from "../app/(app)/(tabs)/HeatmapScreen";
import LoginScreen from "../app/(app)/(auth)/LoginScreen";
import NewComplaintScreen from "../app/(app)/(tabs)/NewComplaintScreen";
import RegisterScreen from "../app/(app)/(auth)/RegisterScreen";
import SettingsScreen from "../app/(app)/(tabs)/SettingsScreen";
import WelcomeScreen from "../app/(app)/(auth)/WelcomeScreen";
import { darkColors, lightColors } from "../theme/colors";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const TAB_BAR_HEIGHT = 74;
const TAB_BAR_BOTTOM_OFFSET = 16;
const TAB_BAR_WIDTH = "95%";
const SCREEN_BOTTOM_INSET = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_OFFSET + 24;

function MainTabs() {
  const { t } = useTranslation();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: {
          paddingBottom: SCREEN_BOTTOM_INSET,
        },
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
            Dashboard: Grid2x2,
            Chat: Mic,
            NewComplaint: PlusCircle,
            Heatmap: Flame,
            Settings: Settings,
          };
          const Icon = iconMap[route.name] || Grid2x2;

          return <Icon size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: t("dashboard") }}
      />
      <Tab.Screen
        name="Heatmap"
        component={HeatmapScreen}
        options={{ title: t("heatmap") }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
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
      <Tab.Screen
        name="NewComplaint"
        component={NewComplaintScreen}
        options={{ title: t("newComplaint") }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t("settings") }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { token, loading } = useAuth();
  const { theme } = usePreferences();
  const { t } = useTranslation();

  const colors = theme === "dark" ? darkColors : lightColors;
  const navTheme = {
    ...(theme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.backgroundPrimary,
      card: colors.backgroundCard,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.primary,
    },
  };

  if (loading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text className="mt-3" style={{ color: colors.textPrimary }}>
          {t("loading")}
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="ComplaintsList"
              component={ComplaintsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ComplaintDetail"
              component={ComplaintDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
