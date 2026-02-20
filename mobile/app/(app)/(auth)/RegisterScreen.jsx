import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Card from "../../../components/Card";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;
  const [form, setForm] = useState({ fullName: "", username: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      setError("");
      await register(form);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="mt-4 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>{t("register")}</Text>
        <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Create your account in under a minute</Text>

        <Card className="mt-6">
          <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("fullName")}</Text>
          <TextInput value={form.fullName} onChangeText={(v) => setField("fullName", v)} style={inputStyle} />
          <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("username")}</Text>
          <TextInput value={form.username} onChangeText={(v) => setField("username", v)} style={inputStyle} />
          <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("email")}</Text>
          <TextInput value={form.email} onChangeText={(v) => setField("email", v)} style={inputStyle} />
          <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("phone")}</Text>
          <TextInput value={form.phone} onChangeText={(v) => setField("phone", v)} style={inputStyle} />
          <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("password")}</Text>
          <TextInput value={form.password} onChangeText={(v) => setField("password", v)} secureTextEntry style={inputStyle} />
          {!!error && <Text className="mb-3 text-sm text-rose-500">{error}</Text>}
          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            className={`h-12 items-center justify-center rounded-lg ${submitting ? "opacity-60" : ""}`}
            style={{ backgroundColor: colors.primary }}
          >
            <Text style={{ color: colors.dark, fontWeight: "700" }}>{submitting ? t("loading") : t("register")}</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
