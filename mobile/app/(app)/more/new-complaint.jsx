import { useRouter } from "expo-router";
import { Camera, X, Navigation } from "lucide-react-native";
import { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  View,
  Image,
  ActivityIndicator,
} from "react-native";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import CustomPicker from "../../../components/CustomPicker";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { CREATE_COMPLAINT_URL } from "../../../url";
import { useNetworkStatus } from "../../../utils/useNetworkStatus";
import { enqueue } from "../../../utils/offlineQueue";

function ComplaintInput({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  colors,
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      multiline={multiline}
      className="rounded-xl border px-3 py-2.5"
      style={{
        borderColor: colors.border,
        color: colors.textPrimary,
        backgroundColor: colors.backgroundSecondary,
        minHeight: multiline ? 110 : 48,
        height: multiline ? undefined : 48,
        textAlignVertical: multiline ? "top" : "center",
      }}
    />
  );
}

export default function NewComplaintPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const { isOnline } = useNetworkStatus();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("Road");
  const [locationName, setLocationName] = useState("");
  const [priority, setPriority] = useState("Low");
  const [saving, setSaving] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [coordinates, setCoordinates] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const DEPARTMENT_OPTIONS = [
    { label: t("complaints.departments.road"), value: "Road" },
    { label: t("complaints.departments.water"), value: "Water" },
    { label: t("complaints.departments.electricity"), value: "Electricity" },
    { label: t("complaints.departments.waste"), value: "Waste" },
    { label: t("complaints.departments.drainage"), value: "Drainage" },
    { label: t("complaints.departments.other"), value: "Other" },
  ];

  const PRIORITY_OPTIONS = [
    { label: t("complaints.priority.low"), value: "Low" },
    { label: t("complaints.priority.medium"), value: "Medium" },
    { label: t("complaints.priority.high"), value: "High" },
  ];

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: t("toast.error.permissionDenied"),
          text2: t("toast.error.cameraRequired"),
        });
        return;
      }

      if (selectedImages.length >= 5) {
        Toast.show({
          type: "error",
          text1: t("toast.error.maximumReached"),
          text2: t("toast.error.onlyFiveImages"),
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets) {
        setSelectedImages([...selectedImages, ...result.assets]);
      }
    } catch {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: t("toast.error.photoError"),
      });
    }
  };

  const removeImage = (index) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const fetchCurrentLocation = async () => {
    try {
      setFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: t("toast.error.permissionDenied"),
          text2: t("toast.error.locationPermissionRequired"),
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 15000,
      });

      setCoordinates({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });

      Toast.show({
        type: "success",
        text1: t("toast.success.locationCaptured"),
        text2: `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`,
      });
    } catch {
      Toast.show({
        type: "error",
        text1: t("toast.error.locationFailed"),
        text2: t("toast.error.locationError"),
      });
    } finally {
      setFetchingLocation(false);
    }
  };

  const onSubmit = async () => {
    if (
      !title.trim() ||
      !description.trim() ||
      !department.trim() ||
      !priority.trim() ||
      !locationName.trim()
    ) {
      Toast.show({
        type: "error",
        text1: t("toast.error.missingFields"),
        text2: t("toast.error.fillRequired"),
      });
      return;
    }

    if (!coordinates) {
      Toast.show({
        type: "error",
        text1: t("toast.error.missingFields"),
        text2: t("complaints.coordinatesRequired"),
      });
      return;
    }

    if (selectedImages.length === 0) {
      Toast.show({
        type: "error",
        text1: t("toast.error.missingFields"),
        text2: t("complaints.proofImagesRequired"),
      });
      return;
    }

    if (!isOnline) {
      await enqueue({
        title: title.trim(),
        description: description.trim(),
        department: department.trim(),
        locationName: locationName.trim(),
        priority,
        coordinates,
        images: selectedImages.map((img) => ({ uri: img.uri })),
      });
      Toast.show({
        type: "info",
        text1: t("complaints.offlineSavedTitle"),
        text2: t("complaints.offlineSavedMessage"),
      });
      router.replace("/(app)/(tabs)/complaints");
      return;
    }

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("department", department.trim());
      formData.append("locationName", locationName.trim());
      formData.append("priority", priority);
      formData.append("coordinates", JSON.stringify(coordinates));

      selectedImages.forEach((image) => {
        const uri = image.uri;
        const filename = uri.split("/").pop();
        const match = /\.([\w]+)$/.exec(filename || "");
        const type = match ? `image/${match[1]}` : "image/jpeg";

        formData.append("images", {
          uri,
          name: filename,
          type,
        });
      });

      const res = await apiCall({
        method: "POST",
        url: CREATE_COMPLAINT_URL,
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const payload = res?.data;
      const ticketId = payload?.complaint?.ticketId || "";
      Toast.show({
        type: "success",
        text1: t("complaints.complaintCreated"),
        text2: ticketId
          ? `${t("complaints.ticketLabel")}: ${ticketId}`
          : t("complaints.savedSuccessfully"),
      });

      router.replace("/(app)/(tabs)/complaints");
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2:
          e?.response?.data?.message || t("toast.error.createComplaintFailed"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("complaints.newComplaint")} />

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-2.5">
          <Text
            className="text-base font-bold mb-1"
            style={{ color: colors.textPrimary }}
          >
            {t("complaints.form.title")}
          </Text>
          <ComplaintInput
            value={title}
            onChangeText={setTitle}
            placeholder={t("complaints.form.titlePlaceholder")}
            colors={colors}
          />
        </View>

        <View className="mb-2.5">
          <Text
            className="text-base font-bold mb-1"
            style={{ color: colors.textPrimary }}
          >
            {t("complaints.form.description")}
          </Text>
          <ComplaintInput
            value={description}
            onChangeText={setDescription}
            placeholder={t("complaints.form.descriptionPlaceholder")}
            multiline
            colors={colors}
          />
        </View>

        <View className="mb-2.5">
          <Text
            className="text-base font-bold mb-1"
            style={{ color: colors.textPrimary }}
          >
            {t("complaints.form.department")}
          </Text>
          <CustomPicker
            data={DEPARTMENT_OPTIONS}
            value={department}
            onChange={(item) => setDepartment(item.value)}
            placeholder={t("complaints.form.departmentPlaceholder")}
            searchPlaceholder={null}
            containerStyle={{
              borderColor: colors.border,
              backgroundColor: colors.backgroundSecondary,
              borderRadius: 12,
              height: 48,
            }}
          />
        </View>

        <View className="mb-2.5">
          <Text
            className="text-base font-bold mb-1"
            style={{ color: colors.textPrimary }}
          >
            {t("complaints.form.priority")}
          </Text>
          <CustomPicker
            data={PRIORITY_OPTIONS}
            value={priority}
            onChange={(item) => setPriority(item.value)}
            placeholder={t("complaints.form.priorityPlaceholder")}
            searchPlaceholder={null}
            containerStyle={{
              borderColor: colors.border,
              backgroundColor: colors.backgroundSecondary,
              borderRadius: 12,
              height: 48,
            }}
          />
        </View>

        <View className="mb-2.5">
          <Text
            className="text-base font-bold mb-1"
            style={{ color: colors.textPrimary }}
          >
            {t("complaints.form.location")}
          </Text>
          <ComplaintInput
            value={locationName}
            onChangeText={setLocationName}
            placeholder={t("complaints.form.locationPlaceholder")}
            colors={colors}
          />
        </View>

        <View className="mb-2.5">
          <Text
            className="text-base font-bold mb-1"
            style={{ color: colors.textPrimary }}
          >
            {t("complaints.gpsCoordinates")}
          </Text>
          <View className="flex-row">
            <PressableBlock
              onPress={fetchCurrentLocation}
              disabled={fetchingLocation}
              className="flex-1 flex-row items-center justify-center py-3 rounded-xl border"
              style={{
                borderColor: coordinates ? colors.primary : colors.border,
                backgroundColor: coordinates
                  ? `${colors.primary}22`
                  : colors.backgroundSecondary,
              }}
            >
              {fetchingLocation ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Navigation
                    size={18}
                    color={coordinates ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    className="text-sm font-semibold ml-2"
                    style={{
                      color: coordinates ? colors.primary : colors.textPrimary,
                    }}
                  >
                    {coordinates
                      ? `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`
                      : t("complaints.captureLocation")}
                  </Text>
                </>
              )}
            </PressableBlock>
          </View>
        </View>

        <View className="mb-2.5">
          <Text
            className="text-base font-bold mb-1"
            style={{ color: colors.textPrimary }}
          >
            {t("complaints.proofImages")}
          </Text>

          {selectedImages.length > 0 && (
            <View className="flex-row flex-wrap mb-2">
              {selectedImages.map((image, index) => (
                <View key={index} className="mr-2 mb-2 relative">
                  <Image
                    source={{ uri: image.uri }}
                    className="w-20 h-20 rounded-lg"
                  />
                  <PressableBlock
                    onPress={() => removeImage(index)}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.danger }}
                  >
                    <X size={14} color="#FFFFFF" />
                  </PressableBlock>
                </View>
              ))}
            </View>
          )}

          {selectedImages.length < 5 && (
            <View className="flex-row">
              <PressableBlock
                onPress={takePhoto}
                className="flex-1 flex-row items-center justify-center py-3 rounded-xl border"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                <Camera size={18} color={colors.textPrimary} />
                <Text
                  className="text-sm font-semibold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.takePhoto")}
                </Text>
              </PressableBlock>
            </View>
          )}
        </View>

        <PressableBlock
          onPress={onSubmit}
          disabled={saving}
          className="mt-1 rounded-xl items-center justify-center py-3.5"
          style={{ backgroundColor: colors.primary }}
        >
          <Text
            className="text-base font-extrabold"
            style={{ color: colors.dark }}
          >
            {saving ? t("complaints.saving") : t("complaints.submitComplaint")}
          </Text>
        </PressableBlock>
      </ScrollView>
    </View>
  );
}
