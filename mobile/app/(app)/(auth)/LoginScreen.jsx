import { useState } from "react";
import { ShieldCheck } from "lucide-react-native";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Card from "../../../components/Card";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="mt-4 items-center">
          <View
            className="h-28 w-28 items-center justify-center rounded-2xl"
            style={{ backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border }}
          >
            <ShieldCheck size={48} color={colors.primary} />
          </View>
        </View>

        <Text className="mt-4 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>
          {t("login")}
        </Text>
        <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
          Continue to your citizen assistance workspace
        </Text>

        <Card className="mt-6">
          <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("loginId")}</Text>
          <TextInput
            value={loginId}
            onChangeText={setLoginId}
            placeholder={t("loginId")}
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard,
              color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12,
            }}
          />
          <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("password")}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t("password")}
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard,
              color: colors.textPrimary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12,
            }}
          />
          {!!error && <Text className="mb-3 text-sm text-rose-500">{error}</Text>}
          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            className={`h-12 items-center justify-center rounded-lg ${submitting ? "opacity-60" : ""}`}
            style={{ backgroundColor: colors.primary }}
          >
            <Text style={{ color: colors.dark, fontWeight: "700" }}>{submitting ? t("loading") : t("login")}</Text>
          </Pressable>
        </Card>

        <Text onPress={() => navigation.navigate("Register")} className="mt-5 text-center text-sm underline" style={{ color: colors.textSecondary }}>
          {t("register")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
