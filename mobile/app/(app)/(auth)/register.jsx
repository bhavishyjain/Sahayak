import * as Clarity from "@microsoft/react-native-clarity";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Keyboard, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { TextInput as PaperTextInput } from "react-native-paper";
import { REGISTER_URL } from "../../../url";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import LanguagePicker from "../../../components/LanguagePicker";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { setUserAuth } from "../../../utils/userAuth";

export default function Register() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();
  const { t } = useTranslation();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Clarity.setCurrentScreenName("Register");
  }, []);

  const handleRegister = async () => {
    Keyboard.dismiss();

    if (
      !fullName.trim() ||
      !username.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !password.trim()
    ) {
      Toast.show({
        type: "error",
        text1: t("toast.registerError.missingFields"),
        text2: t("toast.registerError.fillAllFields"),
      });
      return;
    }

    try {
      setLoading(true);

      const response = await apiCall({
        method: "POST",
        url: REGISTER_URL,
        data: {
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
        },
      });

      const responseData = response?.data || {};
      const authToken = responseData?.token;
      const userData = responseData?.user || {};

      if (!authToken) {
        Toast.show({
          type: "error",
          text1: t("toast.registerError.title"),
          text2:
            responseData?.message || t("toast.registerError.tokenNotReturned"),
        });
        return;
      }

      await setUserAuth({
        ...userData,
        auth_token: authToken,
        token: authToken,
      });

      Toast.show({
        type: "success",
        text1: t("toast.registerSuccess.title"),
        text2: responseData?.message || t("toast.registerSuccess.message"),
      });

      if (userData.role === "user") {
        router.replace({
          pathname: "/(app)/(auth)/verify-email",
          params: { email: userData.email || email.trim().toLowerCase() },
        });
      } else {
        router.replace("/(app)/(tabs)/home");
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.registerError.title"),
        text2:
          error?.response?.data?.message ||
          error?.message ||
          t("toast.registerError.failed"),
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
      enableOnAndroid
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
              tintColor:
                colorScheme === "dark" ? undefined : colors.textPrimary,
            }}
            resizeMode="contain"
          />
        </View>

        <Text
          className="text-[28px] font-fira-bold mb-4 text-center"
          style={{ color: colors.textPrimary }}
        >
          {t("auth.register.title")}
        </Text>
        <Text
          className="text-sm mb-8 text-center px-5"
          style={{ color: colors.textSecondary }}
        >
          {t("auth.register.subtitle")}
        </Text>

        {[
          {
            value: fullName,
            onChangeText: setFullName,
            placeholder: t("auth.register.fullNamePlaceholder"),
          },
          {
            value: username,
            onChangeText: setUsername,
            placeholder: t("auth.register.usernamePlaceholder"),
            autoCapitalize: "none",
          },
          {
            value: email,
            onChangeText: setEmail,
            placeholder: t("auth.register.emailPlaceholder"),
            keyboardType: "email-address",
            autoCapitalize: "none",
          },
          {
            value: phone,
            onChangeText: setPhone,
            placeholder: t("auth.register.phonePlaceholder"),
            keyboardType: "phone-pad",
          },
        ].map((input, index) => (
          <View
            key={index}
            className="flex-row items-center w-full rounded-lg px-4 mb-4 h-[50px]"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.muted,
            }}
          >
            <PaperTextInput
              mode="flat"
              value={input.value}
              onChangeText={input.onChangeText}
              placeholder={input.placeholder}
              placeholderTextColor={colors.placeholder}
              keyboardType={input.keyboardType}
              autoCapitalize={input.autoCapitalize || "sentences"}
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
        ))}

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
            placeholder={t("auth.register.passwordPlaceholder")}
            placeholderTextColor={colors.placeholder}
            secureTextEntry={secure}
            autoCapitalize="none"
            style={{ flex: 1, backgroundColor: "transparent" }}
            underlineStyle={{ display: "none" }}
            contentStyle={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: "600",
              paddingHorizontal: 0,
            }}
            theme={{ colors: { text: colors.textPrimary } }}
            right={
              <PaperTextInput.Icon
                icon={secure ? "eye-off" : "eye"}
                onPress={() => setSecure((v) => !v)}
              />
            }
          />
        </View>

        <PressableBlock
          className="w-full py-4 rounded-lg items-center mb-4"
          style={{ backgroundColor: colors.primary }}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color={colors.dark} />
              <Text
                className="ml-3 text-base font-fira-bold"
                style={{ color: colors.dark, opacity: 0.5 }}
              >
                {t("auth.register.loading")}
              </Text>
            </View>
          ) : (
            <Text
              className="text-base font-fira-bold"
              style={{ color: colors.dark }}
            >
              {t("auth.register.button")}
            </Text>
          )}
        </PressableBlock>

        <PressableBlock
          onPress={() => router.back()}
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
            {t("auth.register.backToLogin")}
          </Text>
        </PressableBlock>

        <LanguagePicker />
      </View>
    </KeyboardAwareScrollView>
  );
}
