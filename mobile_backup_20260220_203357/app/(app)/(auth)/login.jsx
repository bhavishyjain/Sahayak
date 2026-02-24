import { Eye, EyeOff } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import LanguagePicker from "../../../components/LanguagePicker";
import PressableBlock from "../../../components/PressableBlock";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { login } = useAuth();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    Keyboard.dismiss();
    if (!loginId.trim() || !password.trim()) {
      setError("Please enter login ID and password.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await login(loginId.trim(), password);
    } catch (e) {
      setError(e?.message || t("failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingVertical: 20,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center mt-10">
        <View className="w-full items-start mb-5">
          <Image
            source={require("../../../assets/images/mono-logo.png")}
            style={{
              width: 120,
              height: 40,
              tintColor: theme === "dark" ? undefined : colors.textPrimary,
            }}
            resizeMode="contain"
          />
        </View>

        <Image
          source={require("../../../assets/images/login-image-hero.webp")}
          style={{ width: 250, height: 250, marginBottom: 24 }}
          resizeMode="contain"
        />

        <Text
          className="text-[28px] mb-4 text-center font-extrabold"
          style={{ color: colors.textPrimary }}
        >
          {t("login")}
        </Text>
        <Text
          className="text-sm mb-8 text-center px-5"
          style={{ color: colors.textSecondary }}
        >
          Continue with your registered account.
        </Text>

        <View
          className="flex-row items-center w-full rounded-lg px-4 mb-4 h-[50px]"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.muted,
          }}
        >
          <TextInput
            value={loginId}
            onChangeText={setLoginId}
            placeholder="Email, phone, or username"
            placeholderTextColor={colors.placeholder || colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
            }}
          />
        </View>

        <View
          className="flex-row items-center w-full rounded-lg px-4 mb-5 h-[50px]"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.muted,
          }}
        >
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("password")}
            placeholderTextColor={colors.placeholder || colors.muted}
            secureTextEntry={secure}
            autoCapitalize="none"
            style={{
              flex: 1,
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
            }}
          />
          <PressableBlock onPress={() => setSecure((v) => !v)}>
            {secure ? (
              <EyeOff size={18} color={colors.textSecondary} />
            ) : (
              <Eye size={18} color={colors.textSecondary} />
            )}
          </PressableBlock>
        </View>

        {!!error && (
          <Text
            className="text-sm mb-4 text-center"
            style={{ color: colors.danger }}
          >
            {error}
          </Text>
        )}

        <PressableBlock
          className="w-full py-4 rounded-lg items-center mb-4"
          style={{ backgroundColor: colors.primary }}
          onPress={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color={colors.dark} />
              <Text
                className="ml-2 font-bold"
                style={{ color: colors.dark, fontSize: 16 }}
              >
                {t("loading")}
              </Text>
            </View>
          ) : (
            <Text
              className="font-bold"
              style={{ color: colors.dark, fontSize: 16 }}
            >
              {t("login")}
            </Text>
          )}
        </PressableBlock>

        <PressableBlock
          className="w-full py-4 mb-8 rounded-xl items-center"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.muted,
          }}
          onPress={() => router.push("/(app)/(auth)/register")}
        >
          <Text
            style={{
              textAlign: "center",
              fontSize: 16,
              fontWeight: "600",
              color: colors.textSecondary,
            }}
          >
            {t("register")}
          </Text>
        </PressableBlock>

        <View style={{ marginTop: 4 }}>
          <LanguagePicker />
        </View>
      </View>
    </ScrollView>
  );
}
