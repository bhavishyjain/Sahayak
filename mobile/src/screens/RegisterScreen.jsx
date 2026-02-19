import { useState } from "react";
import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import ScreenShell from "../components/ScreenShell";
import SurfaceCard from "../components/SurfaceCard";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

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

  return (
    <ScreenShell>
      <Text className="mt-4 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>{t("register")}</Text>
      <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Create your account in under a minute</Text>

      <SurfaceCard className="mt-6">
        <AppInput label={t("fullName")} value={form.fullName} onChangeText={(v) => setField("fullName", v)} />
        <AppInput label={t("username")} value={form.username} onChangeText={(v) => setField("username", v)} />
        <AppInput label={t("email")} value={form.email} onChangeText={(v) => setField("email", v)} />
        <AppInput label={t("phone")} value={form.phone} onChangeText={(v) => setField("phone", v)} />
        <AppInput label={t("password")} value={form.password} onChangeText={(v) => setField("password", v)} secureTextEntry />
        {!!error && <Text className="mb-3 text-sm text-rose-500">{error}</Text>}
        <AppButton label={submitting ? t("loading") : t("register")} onPress={onSubmit} disabled={submitting} />
      </SurfaceCard>
    </ScreenShell>
  );
}
