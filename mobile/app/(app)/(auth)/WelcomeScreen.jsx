import { Sparkles } from "lucide-react-native";
import { Pressable, SafeAreaView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Card from "../../../components/Card";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";

export default function WelcomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary, paddingHorizontal: 16 }}>
      <View className="mt-10 items-center">
        <View
          className="h-36 w-36 items-center justify-center rounded-2xl"
          style={{ backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border }}
        >
          <Sparkles size={58} color={colors.primary} />
        </View>
      </View>

      <Card className="mt-5">
        <Text className="text-3xl font-extrabold" style={{ color: colors.textPrimary }}>{t("appTitle")}</Text>
        <Text className="mt-1 text-base font-semibold" style={{ color: colors.primary }}>{t("tagline")}</Text>
        <Text className="mt-4 text-base leading-6" style={{ color: colors.textPrimary }}>{t("welcome")}</Text>
        <Text className="mt-2 text-sm leading-6" style={{ color: colors.textSecondary }}>{t("welcomeDesc")}</Text>
      </Card>

      <View className="mt-auto mb-8 gap-3">
        <Pressable onPress={() => navigation.navigate("Login")} className="h-12 items-center justify-center rounded-lg" style={{ backgroundColor: colors.primary }}>
          <Text style={{ color: colors.dark, fontWeight: "700" }}>{t("getStarted")}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Register")} className="h-12 items-center justify-center rounded-lg border" style={{ borderColor: colors.border, backgroundColor: colors.backgroundSecondary }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{t("register")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
