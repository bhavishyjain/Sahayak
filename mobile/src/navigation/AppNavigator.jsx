import { Ionicons } from "@expo/vector-icons";
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
import ChatScreen from "../screens/ChatScreen";
import ComplaintsScreen from "../screens/ComplaintsScreen";
import DashboardScreen from "../screens/DashboardScreen";
import LoginScreen from "../screens/LoginScreen";
import NewComplaintScreen from "../screens/NewComplaintScreen";
import RegisterScreen from "../screens/RegisterScreen";
import SettingsScreen from "../screens/SettingsScreen";
import WelcomeScreen from "../screens/WelcomeScreen";
import { darkColors, lightColors } from "../theme/colors";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { t } = useTranslation();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          bottom: 16,
          alignSelf: "center",
          width: "95%",
          height: 74,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingTop: 10,
          paddingBottom: 10,
        },
        tabBarBackground: () => <CurvedTabBar colors={colors} height={74} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            Dashboard: "grid",
            Chat: "mic",
            NewComplaint: "add-circle",
            Complaints: "list",
            Settings: "settings",
          };

          return <Ionicons name={iconMap[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: t("dashboard") }}
      />
      <Tab.Screen
        name="Complaints"
        component={ComplaintsScreen}
        options={{ title: t("complaints") }}
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
                <Ionicons
                  name="mic"
                  size={28}
                  color={focused ? colors.dark : "#111111"}
                />
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
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.backgroundPrimary }}>
        <ActivityIndicator color={colors.primary} />
        <Text className="mt-3" style={{ color: colors.textPrimary }}>{t("loading")}</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="MainTabs" component={MainTabs} />
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
