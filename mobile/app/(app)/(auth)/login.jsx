import * as Clarity from "@microsoft/react-native-clarity";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Keyboard, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { TextInput as PaperTextInput } from "react-native-paper";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import LanguagePicker from "../../../components/LanguagePicker";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { setUserAuth } from "../../../utils/userAuth";
import { LOGIN_URL } from "../../../url";
import { registerPushToken } from "../../../utils/pushToken";

export default function Login() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Clarity.setCurrentScreenName("Login");
  }, []);

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!email || email.trim() === "") {
      Toast.show({
        type: "error",
        text1: t("toast.loginError.title"),
        text2: t("toast.loginError.enterEmail"),
      });
      return;
    }

    if (!password || password.trim() === "") {
      Toast.show({
        type: "error",
        text1: t("toast.loginError.title"),
        text2: t("toast.loginError.enterPassword"),
      });
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall({
        method: "POST",
        url: LOGIN_URL,
        data: {
          loginId: email.trim(),
          password: password,
        },
      });
      const responseData = response?.data || {};
      const authToken = responseData?.token;
      const userData = responseData?.user || {};

      if (authToken) {
        const userToStore = {
          ...userData,
          auth_token: authToken,
          token: authToken,
          refresh_token: responseData?.refreshToken || null,
        };

        await setUserAuth(userToStore);

        // Register device for push notifications (non-blocking)
        registerPushToken();

        Toast.show({
          type: "success",
          text1: t("toast.loginSuccess.title"),
          text2: responseData?.message || t("toast.loginSuccess.message"),
        });

        // Redirect based on user role
        const redirectPath =
          userData.role === "admin"
            ? "/(app)/(tabs)/admin-home"
            : userData.role === "head"
            ? "/(app)/(tabs)/hod-overview"
            : userData.role === "worker"
              ? "/(app)/(tabs)/worker-home"
              : "/(app)/(tabs)/home";
        router.replace(redirectPath);
      } else {
        console.error("No auth token in response:", userData);
        Toast.show({
          type: "error",
          text1: t("toast.loginError.title"),
          text2: t("toast.loginError.invalidToken"),
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      console.error("Error response:", error?.response?.data);

      const isUnverified =
        error?.response?.data?.details?.emailUnverified === true;
      if (isUnverified) {
        router.push({
          pathname: "/(app)/(auth)/verify-email",
          params: { email: email.trim().toLowerCase() },
        });
      }

      Toast.show({
        type: "error",
        text1: t("toast.loginError.title"),
        text2: error?.response?.data?.message || t("toast.loginError.failed"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingVertical: 20,
        flexGrow: 1,
      }}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={25}
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center mt-10">
        <View className="w-full items-start mb-5">
          <Image
            source={require("../../../assets/images/mono-logo.png")}
            style={{
              width: 120,
              height: 40,
              tintColor: colors.textPrimary,
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
          className="text-[28px] font-fira-bold mb-4 text-center"
          style={{ color: colors.textPrimary }}
        >
          {t("auth.login.title")}
        </Text>
        <Text
          className="text-sm mb-8 text-center px-5"
          style={{ color: colors.textSecondary }}
        >
          {t("auth.login.subtitleEmail")}
        </Text>

        {/* Email Input */}
        <View
          className="flex-row items-center w-full rounded-lg px-4 mb-4 h-[50px]"
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
            style={{
              flex: 1,
              backgroundColor: "transparent",
            }}
            underlineStyle={{ display: "none" }}
            contentStyle={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
              paddingHorizontal: 0,
            }}
            theme={{
              colors: {
                text: colors.textPrimary,
              },
            }}
          />
        </View>

        {/* Password Input */}
        <View
          className="flex-row items-center w-full rounded-lg px-4 mb-5 h-[50px]"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.muted,
          }}
        >
          <PaperTextInput
            mode="flat"
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.login.passwordPlaceholder")}
            placeholderTextColor={colors.placeholder}
            secureTextEntry={secure}
            autoCapitalize="none"
            style={{
              flex: 1,
              backgroundColor: "transparent",
            }}
            underlineStyle={{ display: "none" }}
            contentStyle={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
              paddingHorizontal: 0,
            }}
            theme={{
              colors: {
                text: colors.textPrimary,
              },
            }}
            right={
              <PaperTextInput.Icon
                icon={secure ? "eye-off" : "eye"}
                onPress={() => setSecure(!secure)}
              />
            }
          />
        </View>

        <PressableBlock
          onPress={() => router.push("/(app)/(auth)/forgot-password")}
          className="self-end mb-5"
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.primary }}
          >
            {t("auth.login.forgotPassword")}
          </Text>
        </PressableBlock>

        {/* Login Button */}
        <PressableBlock
          className="w-full py-4 rounded-lg items-center mb-4"
          style={{
            backgroundColor: colors.primary,
          }}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color={colors.dark} />
              <Text
                className="ml-3 text-base font-fira-bold"
                style={{
                  color: colors.dark,
                  opacity: 0.5,
                }}
              >
                {t("auth.login.loading")}
              </Text>
            </View>
          ) : (
            <Text
              className="text-base font-fira-bold"
              style={{ color: colors.dark }}
            >
              {t("auth.login.button")}
            </Text>
          )}
        </PressableBlock>
        <PressableBlock
          onPress={() => router.push("/(app)/(auth)/register")}
          className="py-4 mb-8 rounded-xl active:opacity-80 w-full"
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
            {t("auth.register.button")}
          </Text>
        </PressableBlock>

        {/* Language Selector */}
        <LanguagePicker />
      </View>
    </KeyboardAwareScrollView>
  );
}
