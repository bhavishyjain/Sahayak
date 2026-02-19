import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import ScreenShell from "../components/ScreenShell";
import SurfaceCard from "../components/SurfaceCard";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

const departments = ["road", "water", "electricity", "waste", "drainage", "other"];
const priorities = ["Low", "Medium", "High"];

export default function NewComplaintScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { theme } = usePreferences();
  const colors = useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    department: "other",
    locationName: "",
    priority: "Medium",
    coordinates: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imageUri, setImageUri] = useState(null);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const useLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("permission"), t("locationPermissionRequired"));
      return;
    }

    const current = await Location.getCurrentPositionAsync({});
    setField("coordinates", { lat: current.coords.latitude, lng: current.coords.longitude });
  };

  const submit = async () => {
    try {
      setSubmitting(true);
      setError("");
      await api.createComplaint(token, { ...form, imageUri });
      Alert.alert(t("success"), t("complaintSubmitted"));
      setForm({ title: "", description: "", department: "other", locationName: "", priority: "Medium", coordinates: null });
      setImageUri(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert(t("permission"), t("mediaPermissionRequired"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) setImageUri(result.assets[0].uri);
  };

  return (
    <ScreenShell>
      <Text className="mt-3 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>{t("submitComplaint")}</Text>
      <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Provide clear details for faster action</Text>

      <SurfaceCard className="mt-4">
        <AppInput label={t("title")} value={form.title} onChangeText={(v) => setField("title", v)} />
        <AppInput label={t("description")} value={form.description} onChangeText={(v) => setField("description", v)} multiline />

        <Text className="mb-2 text-sm font-medium" style={{ color: colors.textSecondary }}>{t("department")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row gap-2">
            {departments.map((dep) => {
              const active = form.department === dep;
              return (
                <Pressable
                  key={dep}
                  onPress={() => setField("department", dep)}
                  className="rounded-full px-4 py-2"
                  style={{
                    backgroundColor: active ? colors.primary : colors.backgroundCard,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ color: active ? colors.dark : colors.textPrimary, fontWeight: "600" }}>{dep}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <AppInput label={t("location")} value={form.locationName} onChangeText={(v) => setField("locationName", v)} />

        <Text className="mb-2 text-sm font-medium" style={{ color: colors.textSecondary }}>{t("priority")}</Text>
        <View className="mb-3 flex-row gap-2">
          {priorities.map((p) => {
            const active = form.priority === p;
            return (
              <Pressable
                key={p}
                onPress={() => setField("priority", p)}
                className="rounded-full px-4 py-2"
                style={{
                  backgroundColor: active ? colors.primary : colors.backgroundCard,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{ color: active ? colors.dark : colors.textPrimary, fontWeight: "600" }}>{p}</Text>
              </Pressable>
            );
          })}
        </View>

        <AppButton label={t("attachImage")} variant="secondary" onPress={pickImage} className="mb-2" />
        {imageUri ? <Image source={{ uri: imageUri }} className="mb-2 h-40 w-full rounded-xl" resizeMode="cover" /> : null}
        {!!error && <Text className="mb-2 text-sm text-rose-500">{error}</Text>}
        <AppButton label={t("useCurrentLocation")} variant="secondary" onPress={useLocation} className="mb-2" />
        <AppButton label={submitting ? t("loading") : t("submitComplaint")} onPress={submit} disabled={submitting} />
      </SurfaceCard>
    </ScreenShell>
  );
}
