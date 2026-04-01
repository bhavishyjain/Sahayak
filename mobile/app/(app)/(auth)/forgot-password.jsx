import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Keyboard, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { TextInput as PaperTextInput } from "react-native-paper";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useForgotPasswordAction } from "../../../utils/hooks/useAuthActions";

export default function ForgotPassword() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const { submit, isLoading: loading } = useForgotPasswordAction(t);

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!email.trim()) {
      Toast.show({
        type: "error",
        text1: t("auth.forgotPassword.emailRequiredTitle"),
        text2: t("auth.forgotPassword.emailRequiredMessage"),
      });
      return;
    }

    try {
      await submit(email.trim().toLowerCase());
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: error?.response?.data?.message || t("auth.forgotPassword.requestFailed"),
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
          {t("auth.forgotPassword.title")}
        </Text>
        <Text className="text-sm mb-7" style={{ color: colors.textSecondary }}>
          {t("auth.forgotPassword.subtitle")}
        </Text>

        <View
          className="flex-row items-center rounded-lg px-4 mb-5 h-[50px]"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.muted,
          }}
        >
          <PaperTextInput
            mode="flat"
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.login.emailPlaceholder")}
            placeholderTextColor={colors.placeholder}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, backgroundColor: "transparent" }}
            underlineStyle={{ display: "none" }}
            contentStyle={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
              paddingHorizontal: 0,
            }}
            theme={{ colors: { text: colors.textPrimary } }}
          />
        </View>

        <PressableBlock
          className="w-full py-4 rounded-lg items-center mb-4"
          style={{ backgroundColor: colors.primary }}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.dark} />
          ) : (
            <Text
              className="text-base font-fira-bold"
              style={{ color: colors.dark }}
            >
              {t("auth.forgotPassword.sendButton")}
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
            {t("auth.forgotPassword.backToLogin")}
          </Text>
        </PressableBlock>
      </View>
    </KeyboardAwareScrollView>
  );
}
