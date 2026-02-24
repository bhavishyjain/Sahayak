import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { api } from "../../../api/client";
import Card from "../../../components/Card";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";
import { showToast } from "../../../utils/toast";

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
      showToast({
        title: t("permission"),
        message: t("locationPermissionRequired"),
        type: "warning",
      });
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
      showToast({
        title: t("success"),
        message: t("complaintSubmitted"),
        type: "success",
      });
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
      showToast({
        title: t("permission"),
        message: t("mediaPermissionRequired"),
        type: "warning",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) setImageUri(result.assets[0].uri);
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
    fontSize: 15,
    fontWeight: "600",
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
      <Text className="mt-3 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>{t("submitComplaint")}</Text>
      <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>Provide clear details for faster action</Text>

      <Card className="mt-4">
        <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("title")}</Text>
        <TextInput value={form.title} onChangeText={(v) => setField("title", v)} style={inputStyle} />
        <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("description")}</Text>
        <TextInput value={form.description} onChangeText={(v) => setField("description", v)} style={[inputStyle, { minHeight: 96, textAlignVertical: "top" }]} multiline />

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

        <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{t("location")}</Text>
        <TextInput value={form.locationName} onChangeText={(v) => setField("locationName", v)} style={inputStyle} />

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

        <Pressable onPress={pickImage} className="mb-2 h-12 items-center justify-center rounded-lg border" style={{ borderColor: colors.border, backgroundColor: colors.backgroundSecondary }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{t("attachImage")}</Text>
        </Pressable>
        {imageUri ? <Image source={{ uri: imageUri }} className="mb-2 h-40 w-full rounded-xl" resizeMode="cover" /> : null}
        {!!error && <Text className="mb-2 text-sm text-rose-500">{error}</Text>}
        <Pressable onPress={useLocation} className="mb-2 h-12 items-center justify-center rounded-lg border" style={{ borderColor: colors.border, backgroundColor: colors.backgroundSecondary }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{t("useCurrentLocation")}</Text>
        </Pressable>
        <Pressable onPress={submit} disabled={submitting} className={`h-12 items-center justify-center rounded-lg ${submitting ? "opacity-60" : ""}`} style={{ backgroundColor: colors.primary }}>
          <Text style={{ color: colors.dark, fontWeight: "700" }}>{submitting ? t("loading") : t("submitComplaint")}</Text>
        </Pressable>
      </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
