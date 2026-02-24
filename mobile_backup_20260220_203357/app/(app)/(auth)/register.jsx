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

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { register } = useAuth();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  });
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const inputContainerStyle = {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.muted,
  };

  const inputStyle = {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  };

  const onSubmit = async () => {
    Keyboard.dismiss();
    const { fullName, username, email, phone, password } = form;
    if (!fullName.trim() || !username.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError("Please fill all required fields.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await register({
        ...form,
        fullName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
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
          style={{ width: 220, height: 220, marginBottom: 18 }}
          resizeMode="contain"
        />

        <Text
          className="text-[28px] mb-3 text-center font-extrabold"
          style={{ color: colors.textPrimary }}
        >
          {t("register")}
        </Text>
        <Text
          className="text-sm mb-7 text-center px-5"
          style={{ color: colors.textSecondary }}
        >
          Create your account to continue.
        </Text>

        <View className="flex-row items-center w-full rounded-lg px-4 mb-3 h-[50px]" style={inputContainerStyle}>
          <TextInput
            value={form.fullName}
            onChangeText={(v) => setField("fullName", v)}
            placeholder={t("fullName")}
            placeholderTextColor={colors.placeholder || colors.muted}
            style={inputStyle}
          />
        </View>

        <View className="flex-row items-center w-full rounded-lg px-4 mb-3 h-[50px]" style={inputContainerStyle}>
          <TextInput
            value={form.username}
            onChangeText={(v) => setField("username", v)}
            placeholder={t("username")}
            placeholderTextColor={colors.placeholder || colors.muted}
            autoCapitalize="none"
            style={inputStyle}
          />
        </View>

        <View className="flex-row items-center w-full rounded-lg px-4 mb-3 h-[50px]" style={inputContainerStyle}>
          <TextInput
            value={form.email}
            onChangeText={(v) => setField("email", v)}
            placeholder={t("email")}
            placeholderTextColor={colors.placeholder || colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={inputStyle}
          />
        </View>

        <View className="flex-row items-center w-full rounded-lg px-4 mb-3 h-[50px]" style={inputContainerStyle}>
          <TextInput
            value={form.phone}
            onChangeText={(v) => setField("phone", v)}
            placeholder={t("phone")}
            placeholderTextColor={colors.placeholder || colors.muted}
            keyboardType="phone-pad"
            style={inputStyle}
          />
        </View>

        <View className="flex-row items-center w-full rounded-lg px-4 mb-5 h-[50px]" style={inputContainerStyle}>
          <TextInput
            value={form.password}
            onChangeText={(v) => setField("password", v)}
            placeholder={t("password")}
            placeholderTextColor={colors.placeholder || colors.muted}
            secureTextEntry={secure}
            autoCapitalize="none"
            style={inputStyle}
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
          <Text className="text-sm mb-4 text-center" style={{ color: colors.danger }}>
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
              <Text className="ml-2 font-bold" style={{ color: colors.dark, fontSize: 16 }}>
                {t("loading")}
              </Text>
            </View>
          ) : (
            <Text className="font-bold" style={{ color: colors.dark, fontSize: 16 }}>
              {t("register")}
            </Text>
          )}
        </PressableBlock>

        <PressableBlock onPress={() => router.push("/(app)/(auth)/login")}>
          <Text className="text-base font-semibold underline" style={{ color: colors.textPrimary }}>
            {t("login")}
          </Text>
        </PressableBlock>

        <View style={{ marginTop: 12 }}>
          <LanguagePicker />
        </View>
      </View>
    </ScrollView>
  );
}
