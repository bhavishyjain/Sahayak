import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useUpdateProfile } from "../../../utils/hooks/useProfileActions";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";

// Pure helper functions
const showToast = (type, text1, text2) => Toast.show({ type, text1, text2 });

export default function UpdateProfile() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );
  const inputTheme = useMemo(
    () => ({
      colors: {
        text: colors.textPrimary,
        placeholder: colors.placeholder,
      },
      roundness: 12,
    }),
    [colors],
  );
  // Form fields consolidated into single object
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [uiState, setUiState] = useState({
    loading: false,
    showPassword: false,
  });

  // FORM FIELD UPDATES - Single function for all field updates

  const updateFormField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateUiState = useCallback((updates) => {
    setUiState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Fetch user data query
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const user = await getUserAuth();
      return user;
    },
  });

  // Update form when user data changes
  useEffect(() => {
    if (userData) {
      setFormData({
        fullName: userData.fullName ?? "",
        email: userData.email ?? "",
        phone: userData.phone ?? "",
        password: "",
      });
    }
  }, [userData]);

  // API HANDLERS

  const { updateProfile } = useUpdateProfile(t);

  const handleUpdateProfile = useCallback(() => {
    if (!formData.fullName.trim()) {
      showToast(
        "error",
        t("toast.error.title"),
        t("settings.profile.nameRequired"),
      );
      return;
    }
    if (!formData.phone.trim()) {
      showToast(
        "error",
        t("toast.error.title"),
        t("settings.profile.phoneRequired"),
      );
      return;
    }
    updateUiState({ loading: true });
    updateProfile(formData).catch((error) => {
      console.error("Update profile error:", error);
      showToast(
        "error",
        t("toast.error.title"),
        error?.response?.data?.message ??
          error?.message ??
          t("settings.profile.updateFailed"),
      );
    }).finally(() => updateUiState({ loading: false }));
  }, [formData, t, updateProfile, updateUiState]);

  // UI EVENT HANDLERS

  const togglePasswordVisibility = useCallback(() => {
    setUiState((prev) => ({ ...prev, showPassword: !prev.showPassword }));
  }, []);

  if (userLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("settings.profile.editProfile")} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Email address field (read-only) */}
        <View className="mb-4">
          <Text
            className="text-base font-bold mb-2"
            style={{ color: colors.textPrimary }}
          >
            {t("settings.profile.email")}
          </Text>
          <PaperTextInput
            mode="flat"
            dense
            style={{
              backgroundColor: colors.backgroundSecondary,
              color: colors.textSecondary,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
            }}
            contentStyle={{
              color: colors.textSecondary,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
            underlineStyle={{ display: "none" }}
            value={formData.email}
            editable={false}
            placeholder={t("settings.profile.emailPlaceholder")}
            theme={inputTheme}
          />
        </View>

        {/* Name input field */}
        <View className="mb-4">
          <Text
            className="text-base font-bold mb-2"
            style={{ color: colors.textPrimary }}
          >
            {t("settings.profile.fullName")}
          </Text>
          <PaperTextInput
            mode="flat"
            dense
            style={{
              backgroundColor: colors.backgroundSecondary,
              color: colors.textPrimary,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
            }}
            contentStyle={{
              color: colors.textPrimary,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
            underlineStyle={{ display: "none" }}
            value={formData.fullName}
            onChangeText={(text) => updateFormField("fullName", text)}
            placeholder={t("settings.profile.fullNamePlaceholder")}
            theme={inputTheme}
          />
        </View>

        {/* Phone number input */}
        <View className="mb-4">
          <Text
            className="text-base font-bold mb-2"
            style={{ color: colors.textPrimary }}
          >
            {t("settings.profile.phone")}
          </Text>
          <PaperTextInput
            mode="flat"
            dense
            style={{
              backgroundColor: colors.backgroundSecondary,
              color: colors.textPrimary,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
            }}
            contentStyle={{
              color: colors.textPrimary,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
            underlineStyle={{ display: "none" }}
            value={formData.phone}
            onChangeText={(text) => updateFormField("phone", text)}
            placeholder={t("settings.profile.phonePlaceholder")}
            keyboardType="phone-pad"
            theme={inputTheme}
          />
        </View>

        {/* Password input with show/hide toggle */}
        <View className="mb-6">
          <Text
            className="text-base font-bold mb-2"
            style={{ color: colors.textPrimary }}
          >
            {t("settings.profile.newPassword")}
          </Text>
          <View className="flex-row items-center">
            <PaperTextInput
              mode="flat"
              dense
              style={{
                flex: 1,
                backgroundColor: colors.backgroundSecondary,
                color: colors.textPrimary,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
              }}
              contentStyle={{
                color: colors.textPrimary,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
              underlineStyle={{ display: "none" }}
              value={formData.password}
              onChangeText={(text) => updateFormField("password", text)}
              placeholder={t("settings.profile.passwordPlaceholder")}
              secureTextEntry={!uiState.showPassword}
              theme={inputTheme}
            />
            <PressableBlock
              className="absolute right-3"
              onPress={togglePasswordVisibility}
            >
              {uiState.showPassword ? (
                <Eye size={20} color={colors.textSecondary} />
              ) : (
                <EyeOff size={20} color={colors.textSecondary} />
              )}
            </PressableBlock>
          </View>
        </View>

        {/* Update profile button */}
        <PressableBlock
          className="rounded-xl py-4 items-center mb-4"
          style={{ backgroundColor: colors.primary }}
          onPress={handleUpdateProfile}
          disabled={uiState.loading}
        >
          {uiState.loading ? (
            <ActivityIndicator color={colors.light} />
          ) : (
            <Text className="text-base font-bold" style={{ color: colors.light }}>
              {t("settings.profile.updateProfile")}
            </Text>
          )}
        </PressableBlock>
      </ScrollView>
    </View>
  );
}
