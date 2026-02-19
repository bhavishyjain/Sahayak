import { Image, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppButton from "../components/AppButton";
import ScreenShell from "../components/ScreenShell";
import SurfaceCard from "../components/SurfaceCard";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function WelcomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <ScreenShell scroll={false}>
      <View className="mt-10 items-center">
        <Image source={require("../../assets/hero.jpg")} className="h-36 w-36 rounded-2xl" />
      </View>

      <SurfaceCard className="mt-5">
        <Text className="text-3xl font-extrabold" style={{ color: colors.textPrimary }}>{t("appTitle")}</Text>
        <Text className="mt-1 text-base font-semibold" style={{ color: colors.primary }}>{t("tagline")}</Text>
        <Text className="mt-4 text-base leading-6" style={{ color: colors.textPrimary }}>{t("welcome")}</Text>
        <Text className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>{t("welcomeDesc")}</Text>
      </SurfaceCard>

      <View className="mt-auto mb-8 gap-3">
        <AppButton label={t("getStarted")} onPress={() => navigation.navigate("Login")} />
        <AppButton label={t("register")} variant="secondary" onPress={() => navigation.navigate("Register")} />
      </View>
    </ScreenShell>
  );
}
