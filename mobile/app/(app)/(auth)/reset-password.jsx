import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import AppTextInput from "../../../components/AppTextInput";
import PressableBlock from "../../../components/PressableBlock";
import {
  getPasswordStrengthMessage,
  isStrongPassword,
} from "../../../utils/passwordStrength";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useResetPasswordAction } from "../../../utils/hooks/useAuthActions";

export default function ResetPassword() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams();

  const resetToken = token ? String(token) : "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { resetPassword, isLoading: loading } = useResetPasswordAction(t);

  const handleReset = async () => {
    if (!resetToken) {
      Toast.show({
        type: "error",
        text1: t("auth.resetPassword.invalidLinkTitle"),
        text2: t("auth.resetPassword.invalidLinkMessage"),
      });
      return;
    }

    if (!isStrongPassword(password)) {
      Toast.show({
        type: "error",
        text1: t("auth.resetPassword.weakPasswordTitle"),
        text2: getPasswordStrengthMessage(t),
      });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({
        type: "error",
        text1: t("auth.resetPassword.passwordMismatchTitle"),
        text2: t("auth.resetPassword.passwordMismatchMessage"),
      });
      return;
    }

    try {
      await resetPassword({ token: resetToken, password });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("auth.resetPassword.failedTitle"),
        text2: error?.response?.data?.message || t("auth.resetPassword.failedMessage"),
      });
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingVertical: 28,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={20}
      showsVerticalScrollIndicator={false}
    >
      <View className="mt-8">
        <Text
          className="text-[26px] font-fira-bold mb-2"
          style={{ color: colors.textPrimary }}
        >
          {t("auth.resetPassword.title")}
        </Text>
        <Text className="text-sm mb-7" style={{ color: colors.textSecondary }}>
          {t("auth.resetPassword.subtitle")}
        </Text>

        <AppTextInput
          value={password}
          onChangeText={setPassword}
          placeholder={t("auth.resetPassword.newPasswordPlaceholder")}
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          borderColor={colors.muted}
          activeBorderColor={colors.primary}
          containerStyle={{ marginBottom: 16 }}
          inputContainerStyle={{ minHeight: 50 }}
          inputStyle={{ fontSize: 16, fontWeight: "600", minHeight: 50 }}
        />

        <Text
          className="text-xs mb-4 -mt-2"
          style={{ color: colors.textSecondary }}
        >
          {getPasswordStrengthMessage(t)}
        </Text>

        <AppTextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          autoCapitalize="none"
          borderColor={colors.muted}
          activeBorderColor={colors.primary}
          containerStyle={{ marginBottom: 20 }}
          inputContainerStyle={{ minHeight: 50 }}
          inputStyle={{ fontSize: 16, fontWeight: "600", minHeight: 50 }}
        />

        <PressableBlock
          className="w-full py-4 rounded-lg items-center mb-4"
          style={{ backgroundColor: colors.primary }}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.dark} />
          ) : (
            <Text
              className="text-base font-fira-bold"
              style={{ color: colors.dark }}
            >
              {t("auth.resetPassword.updateButton")}
            </Text>
          )}
        </PressableBlock>

        <PressableBlock
          onPress={() => router.replace("/(app)/(auth)/login")}
          className="py-4 rounded-xl active:opacity-80"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.muted,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontSize: 16,
              fontWeight: "600",
              color: colors.textSecondary,
            }}
          >
            {t("auth.resetPassword.backToLogin")}
          </Text>
        </PressableBlock>
      </View>
    </KeyboardAwareScrollView>
  );
}
