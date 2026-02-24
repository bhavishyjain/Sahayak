import "../global.css";
import "../i18n";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { api } from "../api/client";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import {
  PreferencesProvider,
  usePreferences,
} from "../contexts/PreferencesContext";
import { ThemeProvider } from "../utils/context/theme";
import { getExpoPushToken } from "../utils/pushNotifications";

function RootSlot() {
  const { theme } = usePreferences();
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const pushToken = await getExpoPushToken();
        if (!pushToken) return;
        await api.registerPushToken(token, pushToken);
      } catch (_error) {
        // Keep app usable even if push registration fails.
      }
    })();
  }, [token]);

  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Slot />
      <Toast swipeable position="bottom" />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PreferencesProvider>
          <AuthProvider>
            <RootSlot />
          </AuthProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
