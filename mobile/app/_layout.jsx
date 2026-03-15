import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/utils/context/theme";
import { LanguageProvider } from "@/utils/i18n/LanguageProvider";
import { AppState, View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "@/utils/context/theme";
import { useEffect, useRef } from "react";
import { registerPushToken } from "../utils/pushToken";
import { StatusBar } from "expo-status-bar";
import "../global.css";
import "../utils/i18n/config";

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

  useEffect(() => {
    // Re-register push token whenever the app comes back to the foreground
    // (token can change after OS updates or app reinstalls)
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        registerPushToken();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <StatusBar
        style={colorScheme === "dark" ? "light" : "dark"}
        backgroundColor={colors.backgroundPrimary}
        translucent={false}
      />
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
