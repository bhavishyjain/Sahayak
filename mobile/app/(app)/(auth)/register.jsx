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

    if (!fullName.trim() || !username.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      Toast.show({
        type: "error",
        text1: "Missing fields",
        text2: "Please fill all required fields.",
      });
      return;
    }

    try {
      setLoading(true);
      const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:6000/api";

      const response = await apiCall({
        method: "POST",
        url: `${baseUrl}/auth/register`,
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
          text1: "Registration failed",
          text2: responseData?.message || "Token not returned.",
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
        text1: "Account created",
        text2: responseData?.message || "Welcome to Sahayak.",
      });

      router.replace("/(app)/(tabs)/home");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Registration failed",
        text2: error?.response?.data?.message || error?.message || t("failed"),
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
              tintColor: colorScheme === "dark" ? undefined : colors.textPrimary,
            }}
            resizeMode="contain"
          />
        </View>

        <Text
          className="text-[28px] font-fira-bold mb-4 text-center"
          style={{ color: colors.textPrimary }}
        >
          Create Account
        </Text>
        <Text
          className="text-sm mb-8 text-center px-5"
          style={{ color: colors.textSecondary }}
        >
          Register with your details to continue.
        </Text>

        {[
          {
            value: fullName,
            onChangeText: setFullName,
            placeholder: "Full name",
          },
          {
            value: username,
            onChangeText: setUsername,
            placeholder: "Username",
            autoCapitalize: "none",
          },
          {
            value: email,
            onChangeText: setEmail,
            placeholder: "Email",
            keyboardType: "email-address",
            autoCapitalize: "none",
          },
          {
            value: phone,
            onChangeText: setPhone,
            placeholder: "Phone",
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
            placeholder={t("password") || "Password"}
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
                {t("loading") || "Loading"}
              </Text>
            </View>
          ) : (
            <Text className="text-base font-fira-bold" style={{ color: colors.dark }}>
              Register
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
            Back to Login
          </Text>
        </PressableBlock>

        <LanguagePicker />
      </View>
    </KeyboardAwareScrollView>
  );
}
