import "./global.css";
import "./src/i18n";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { api } from "./src/api/client";
import { useAuth, AuthProvider } from "./src/contexts/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { PreferencesProvider, usePreferences } from "./src/contexts/PreferencesContext";
import { getExpoPushToken } from "./src/utils/pushNotifications";

function Root() {
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
        // Silent fail: app should work even without push token registration.
      }
    })();
  }, [token]);

  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
