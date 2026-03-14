import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import PressableBlock from "../../../components/PressableBlock";
import { UPDATE_USER_PROFILE_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth, { setUserAuth } from "../../../utils/userAuth";

// Pure helper functions
const showToast = (type, text1, text2) => Toast.show({ type, text1, text2 });

export default function UpdateProfile() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );
  const queryClient = useQueryClient();

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

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const response = await apiCall({
        method: "POST",
        url: UPDATE_USER_PROFILE_URL,
        data: {
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          password: formData.password.trim(),
        },
      });
      return response;
    },
    onMutate: () => updateUiState({ loading: true }),
    onSuccess: async (response) => {
      const data = response.data;
      if (response.success) {
        // Update local user data with auth_token preserved
        const currentUser = await getUserAuth();
        const updatedUser = {
          ...currentUser,
          ...data.user,
          auth_token: currentUser?.auth_token, // Preserve token
        };
        await setUserAuth(updatedUser);

        showToast(
          "success",
          t("toast.success.title"),
          t("toast.success.profileUpdated"),
        );
        queryClient.invalidateQueries({ queryKey: ["user-profile"] });
        router.back();
      } else if (data.email_phone_already_used) {
        showToast(
          "error",
          t("toast.error.title"),
          t("settings.profile.emailPhoneInUse"),
        );
      } else {
        showToast(
          "error",
          t("toast.error.title"),
          response.message ?? t("settings.profile.updateFailed"),
        );
      }
    },
    onError: (error) => {
      console.error("Update profile error:", error);
      showToast(
        "error",
        t("toast.error.title"),
        error?.response?.data?.message ??
          error?.message ??
          t("settings.profile.updateFailed"),
      );
    },
    onSettled: () => updateUiState({ loading: false }),
  });

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
    updateProfileMutation.mutate();
  }, [formData, t, updateProfileMutation]);

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
          <TextInput
            className="rounded-xl px-4 py-3"
            style={{
              backgroundColor: colors.backgroundSecondary,
              color: colors.textSecondary,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            value={formData.email}
            editable={false}
            placeholder={t("settings.profile.emailPlaceholder")}
            placeholderTextColor={colors.placeholder}
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
          <TextInput
            className="rounded-xl px-4 py-3"
            style={{
              backgroundColor: colors.backgroundSecondary,
              color: colors.textPrimary,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            value={formData.fullName}
            onChangeText={(text) => updateFormField("fullName", text)}
            placeholder={t("settings.profile.fullNamePlaceholder")}
            placeholderTextColor={colors.placeholder}
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
          <TextInput
            className="rounded-xl px-4 py-3"
            style={{
              backgroundColor: colors.backgroundSecondary,
              color: colors.textPrimary,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            value={formData.phone}
            onChangeText={(text) => updateFormField("phone", text)}
            placeholder={t("settings.profile.phonePlaceholder")}
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
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
            <TextInput
              className="flex-1 rounded-xl px-4 py-3"
              style={{
                backgroundColor: colors.backgroundSecondary,
                color: colors.textPrimary,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              value={formData.password}
              onChangeText={(text) => updateFormField("password", text)}
              placeholder={t("settings.profile.passwordPlaceholder")}
              placeholderTextColor={colors.placeholder}
              secureTextEntry={!uiState.showPassword}
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
