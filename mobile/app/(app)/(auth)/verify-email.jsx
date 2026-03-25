import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useVerifyEmailActions } from "../../../utils/hooks/useAuthActions";

export default function VerifyEmail() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();
  const { t } = useTranslation();
  const { token, email } = useLocalSearchParams();

  const verifyToken = token ? String(token) : "";
  const { verifyEmail, resendVerification, isResending } =
    useVerifyEmailActions(t);

  const [verifying, setVerifying] = useState(!!verifyToken);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState(
    verifyToken
      ? t("auth.verifyEmail.verifying")
      : t("auth.verifyEmail.checkInbox"),
  );

  useEffect(() => {
    if (!verifyToken) return;

    (async () => {
      try {
        const response = await verifyEmail(verifyToken);
        setVerified(true);
        setMessage(response?.message || t("auth.verifyEmail.verifiedMessage"));
        Toast.show({
          type: "success",
          text1: t("auth.verifyEmail.verifiedTitle"),
          text2: t("auth.verifyEmail.verifiedHint"),
        });
      } catch (error) {
        setVerified(false);
        setMessage(
          error?.response?.data?.message ||
            t("auth.verifyEmail.invalidMessage"),
        );
      } finally {
        setVerifying(false);
      }
    })();
  }, [t, verifyEmail, verifyToken]);

  const handleResend = async () => {
    try {
      await resendVerification();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("auth.verifyEmail.resendFailedTitle"),
        text2:
          error?.response?.data?.message ||
          t("auth.verifyEmail.resendFailedMessage"),
      });
    } finally {}
  };

  return (
    <View
      className="flex-1 px-5 pt-12"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <Text
        className="text-[26px] font-fira-bold mb-2"
        style={{ color: colors.textPrimary }}
      >
        {t("auth.verifyEmail.title")}
      </Text>

      {!!email && !verifyToken && (
        <Text className="text-sm mb-2" style={{ color: colors.textSecondary }}>
          {t("auth.verifyEmail.sentTo") + " " + String(email)}
        </Text>
      )}

      <View
        className="rounded-xl p-4 mt-3 mb-6"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {verifying ? (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text
              className="ml-3 text-sm"
              style={{ color: colors.textSecondary }}
            >
              {message}
            </Text>
          </View>
        ) : (
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {message}
          </Text>
        )}
      </View>

      {!verifyToken && (
        <PressableBlock
          className="w-full py-4 rounded-lg items-center mb-4"
          style={{ backgroundColor: colors.primary }}
          onPress={handleResend}
          disabled={isResending}
        >
          {isResending ? (
            <ActivityIndicator size="small" color={colors.dark} />
          ) : (
            <Text
              className="text-base font-fira-bold"
              style={{ color: colors.dark }}
            >
              {t("auth.verifyEmail.resendButton")}
            </Text>
          )}
        </PressableBlock>
      )}

      <PressableBlock
        onPress={() => router.replace("/(app)/(auth)/login")}
        className="w-full py-4 rounded-lg items-center active:opacity-80"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.muted,
        }}
      >
        <Text
          className="text-base font-fira-bold"
          style={{ color: colors.textSecondary }}
        >
          {verified
            ? t("auth.verifyEmail.continueToLogin")
            : t("auth.verifyEmail.backToLogin")}
        </Text>
      </PressableBlock>
    </View>
  );
}
