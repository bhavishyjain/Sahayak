import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import ScreenShell from "../components/ScreenShell";
import SurfaceCard from "../components/SurfaceCard";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      setError("");
      await login(loginId.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell>
      <View className="mt-4 items-center">
        <Image source={require("../../assets/hero.jpg")} className="h-28 w-28 rounded-2xl" />
      </View>

      <Text className="mt-4 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>
        {t("login")}
      </Text>
      <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
        Continue to your citizen assistance workspace
      </Text>

      <SurfaceCard className="mt-6">
        <AppInput label={t("loginId")} value={loginId} onChangeText={setLoginId} />
        <AppInput label={t("password")} value={password} onChangeText={setPassword} secureTextEntry />
        {!!error && <Text className="mb-3 text-sm text-rose-500">{error}</Text>}
        <AppButton label={submitting ? t("loading") : t("login")} onPress={onSubmit} disabled={submitting} />
      </SurfaceCard>

      <Text onPress={() => navigation.navigate("Register")} className="mt-5 text-center text-sm underline" style={{ color: colors.textSecondary }}>
        {t("register")}
      </Text>
    </ScreenShell>
  );
}
