import { Stack, router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "@/utils/context/theme";
import { LanguageProvider } from "@/utils/i18n/LanguageProvider";
import { AppState, View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../colors";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import {
  initializePushNotifications,
  registerPushToken,
} from "../utils/pushToken";
import { openNotificationRoute } from "../utils/notificationNavigation";
import RealtimeBridge from "../components/RealtimeBridge";
import "../global.css";
import "../utils/i18n/config";

const ExpoStatusBar = (() => {
  try {
    return require("expo-status-bar").StatusBar;
  } catch (_error) {
    return () => null;
  }
})();

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootNavigator() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const appState = useRef(AppState.currentState);
  const lastHandledNotificationId = useRef(null);

  useEffect(() => {
    initializePushNotifications().catch(() => {});
    registerPushToken().catch(() => {});

    const handleNotificationOpen = (response) => {
      const notificationId = response?.notification?.request?.identifier;
      if (!notificationId || lastHandledNotificationId.current === notificationId) {
        return;
      }
      lastHandledNotificationId.current = notificationId;
      const data = response?.notification?.request?.content?.data;
      openNotificationRoute(data, router);
    };

    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (__DEV__) {
          console.log(
            "Push notification received:",
            notification?.request?.content,
          );
        }
      },
    );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        if (__DEV__) {
          console.log(
            "Push notification opened:",
            response?.notification?.request?.content,
          );
        }
        handleNotificationOpen(response);
      });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleNotificationOpen(response);
      })
      .catch(() => {});

    // Re-register push token whenever the app comes back to the foreground
    // (token can change after OS updates or app reinstalls)
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        initializePushNotifications().catch(() => {});
        registerPushToken().catch(() => {});
      }
      appState.current = nextState;
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
      subscription.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <ExpoStatusBar
        style={colorScheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.backgroundPrimary}
        translucent={false}
      />
      <RealtimeBridge />
      <Stack screenOptions={{ headerShown: false }} />
      <Toast position="bottom" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <RootNavigator />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
