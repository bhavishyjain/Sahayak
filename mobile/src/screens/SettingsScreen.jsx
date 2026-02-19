import { Alert, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import AppButton from "../components/AppButton";
import ScreenShell from "../components/ScreenShell";
import SurfaceCard from "../components/SurfaceCard";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { logout, token } = useAuth();
  const { theme, language, toggleTheme, changeLanguage } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  const sendTestPush = async () => {
    try {
      await api.sendTestNotification(token);
      Alert.alert(t("success"), t("testNotificationSent"));
    } catch (error) {
      Alert.alert(t("failed"), error.message || t("testNotificationFailed"));
    }
  };

  return (
    <ScreenShell>
      <Text className="mt-3 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>{t("settings")}</Text>
      <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Personalize app behavior and language</Text>

      <SurfaceCard className="mt-5">
        <Text className="mb-3 text-base font-semibold" style={{ color: colors.textPrimary }}>{t("darkMode")}: {theme}</Text>
        <AppButton label={t("darkMode")} onPress={toggleTheme} />
      </SurfaceCard>

      <SurfaceCard className="mt-4">
        <Text className="mb-3 text-base font-semibold" style={{ color: colors.textPrimary }}>{t("language")}: {language.toUpperCase()}</Text>
        <View className="flex-row gap-3">
          <AppButton label={t("english")} onPress={() => changeLanguage("en")} className="flex-1" />
          <AppButton label={t("hindi")} onPress={() => changeLanguage("hi")} className="flex-1" />
        </View>
      </SurfaceCard>

      <SurfaceCard className="mt-4">
        <AppButton label={t("sendTestNotification")} onPress={sendTestPush} />
      </SurfaceCard>

      <AppButton label={t("logout")} variant="secondary" onPress={logout} className="mt-6" />
    </ScreenShell>
  );
}
