import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { darkColors, lightColors } from "../../../colors";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { clearUserAuth } from "../../../utils/userAuth";

export default function LogoutScreen() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const { t } = useTranslation();

  useEffect(() => {
    (async () => {
      await clearUserAuth();
      router.replace("/(app)/(auth)/login");
    })();
  }, [router]);

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <LottieView
        source={require("../../../assets/anims/hand-wave.json")}
        autoPlay
        loop={false}
        style={{ width: 180, height: 180 }}
      />

      <Text
        className="text-base mt-6 font-medium"
        style={{ color: colors.textPrimary }}
      >
        {t("auth.logout.title")}
      </Text>

      <Text className="text-sm mt-2" style={{ color: colors.textSecondary }}>
        {t("auth.logout.subtitle")}
      </Text>
    </View>
  );
}
