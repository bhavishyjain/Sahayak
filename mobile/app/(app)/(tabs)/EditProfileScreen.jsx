import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { api } from "../../../api/client";
import Card from "../../../components/Card";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";
import { showToast } from "../../../utils/toast";

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { token, user, refreshMe } = useAuth();
  const { theme } = usePreferences();
  const colors = useMemo(
    () => (theme === "dark" ? darkColors : lightColors),
    [theme],
  );
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundCard,
    color: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  };

  const submit = async () => {
    try {
      setSaving(true);
      await api.updateMe(token, { fullName, email, phone });
      await refreshMe();
      showToast({
        title: t("success"),
        message: t("profileUpdated"),
        type: "success",
      });
    } catch (error) {
      showToast({
        title: t("failed"),
        message: error.message || t("profileUpdateFailed"),
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
        paddingHorizontal: 16,
      }}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Text
          className="mt-3 text-3xl font-extrabold"
          style={{ color: colors.textPrimary }}
        >
          {t("editProfile")}
        </Text>
        <Text
          className="mb-3 mt-1 text-sm"
          style={{ color: colors.textSecondary }}
        >
          {t("editProfileSubtitle")}
        </Text>

        <Card>
          <Text
            style={{
              marginBottom: 6,
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {t("fullName")}
          </Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            style={inputStyle}
          />
          <Text
            style={{
              marginBottom: 6,
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {t("email")}
          </Text>
          <TextInput value={email} onChangeText={setEmail} style={inputStyle} />
          <Text
            style={{
              marginBottom: 6,
              color: colors.textSecondary,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {t("phone")}
          </Text>
          <TextInput value={phone} onChangeText={setPhone} style={inputStyle} />
          <View className="mt-1">
            <Pressable
              onPress={submit}
              disabled={saving}
              className={`h-12 items-center justify-center rounded-lg ${saving ? "opacity-60" : ""}`}
              style={{ backgroundColor: colors.primary }}
            >
              <Text style={{ color: colors.dark, fontWeight: "700" }}>
                {saving ? t("loading") : t("saveChanges")}
              </Text>
            </Pressable>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
