import { Stack, router } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "@/utils/context/theme";
import { LanguageProvider } from "@/utils/i18n/LanguageProvider";
import { AppState, Keyboard, Platform, StyleSheet, View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../colors";
import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import * as SystemUI from "expo-system-ui";
import {
  initializePushNotifications,
  registerPushToken,
} from "../utils/pushToken";
import { openNotificationRoute } from "../utils/notificationNavigation";
import { prepareReportsStorage } from "../utils/hooks/useReports";
import RealtimeBridge from "../components/RealtimeBridge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
  const appState = useRef(AppState.currentState);
  const lastHandledNotificationId = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.backgroundPrimary).catch(() => {});
  }, [colors.backgroundPrimary]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(0, event?.endCoordinates?.height || 0));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    initializePushNotifications().catch(() => {});
    registerPushToken().catch(() => {});
    prepareReportsStorage().catch(() => {});

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
      async (notification) => {
        if (__DEV__) {
          console.log(
            "Push notification received:",
            notification?.request?.content,
          );
        }

        const isForeground = appState.current === "active";
        const alreadyEchoed = Boolean(
          notification?.request?.content?.data?.__foregroundEcho,
        );

        if (!isForeground || alreadyEchoed) return;

        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: notification?.request?.content?.title,
              body: notification?.request?.content?.body,
              data: {
                ...(notification?.request?.content?.data || {}),
                __foregroundEcho: true,
              },
              sound: "default",
            },
            trigger: null,
          });
        } catch (_error) {
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
      <View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            zIndex: 2147483647,
            elevation: 2147483647,
          },
        ]}
      >
        <Toast
          position="bottom"
          bottomOffset={
            keyboardHeight > 0
              ? Math.max(32, keyboardHeight + 20)
              : Platform.OS === "android"
                ? Math.max(insets.bottom + 148, 148)
                : Math.max(insets.bottom + 28, 40)
          }
        />
      </View>
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
