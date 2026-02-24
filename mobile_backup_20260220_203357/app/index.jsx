import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function Index() {
  const { token, loading } = useAuth();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.backgroundPrimary,
        }}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Redirect href="/(app)/(auth)/login" />;
}
