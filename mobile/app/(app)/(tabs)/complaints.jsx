import { useRouter } from "expo-router";
import {
  Search,
  Plus,
  Clock,
  MapPin,
  Camera,
  X,
  Navigation,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  RefreshControl,
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
import AutoSkeleton from "../../../components/AutoSkeleton";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import CustomPicker from "../../../components/CustomPicker";
import DialogBox from "../../../components/DialogBox";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { getStatusColor, getPriorityColor } from "../../../utils/colorHelpers";
import {
  formatDateShort,
  formatEtaFromHours,
  formatPriorityLabel,
  formatStatusLabel,
} from "../../../utils/complaintFormatters";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { API_BASE } from "../../../url";

export default function Complaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("Road");
  const [locationName, setLocationName] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdTicket, setCreatedTicket] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [coordinates, setCoordinates] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const baseUrl = API_BASE;

  const DEPARTMENT_OPTIONS = [
    { label: t("complaints.departments.road"), value: "Road" },
    { label: t("complaints.departments.water"), value: "Water" },
    { label: t("complaints.departments.electricity"), value: "Electricity" },
    { label: t("complaints.departments.waste"), value: "Waste" },
    { label: t("complaints.departments.other"), value: "Other" },
  ];

  const PRIORITY_OPTIONS = [
    { label: t("complaints.priority.low"), value: "Low" },
    { label: t("complaints.priority.medium"), value: "Medium" },
    { label: t("complaints.priority.high"), value: "High" },
  ];

  const load = async (pull = false) => {
    try {
      if (pull) setRefreshing(true);
      else setLoading(true);

      const q = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
      const res = await apiCall({
        method: "GET",
        url: `${baseUrl}/complaints${q}`,
      });
      const payload = res?.data;
      setComplaints(payload?.complaints || []);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2:
          e?.response?.data?.message || t("toast.error.loadComplaintsFailed"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, [status]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return complaints;
    return complaints.filter((c) => {
      return (
        String(c.ticketId || "")
          .toLowerCase()
          .includes(q) ||
        String(c.department || "")
          .toLowerCase()
          .includes(q) ||
        String(c.locationName || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [complaints, search]);

  const pickImages = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: t("toast.error.permissionDenied"),
          text2: t("toast.error.permissionRequired"),
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets) {
        const totalImages = selectedImages.length + result.assets.length;
        if (totalImages > 5) {
          Toast.show({
            type: "error",
            text1: t("toast.error.tooManyImages"),
            text2: t("toast.error.maxImagesReached"),
          });
          return;
        }
        setSelectedImages([...selectedImages, ...result.assets]);
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.title"),
        text2: t("toast.error.imageSelectError"),
      });
    }
  };

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
    } catch (error) {
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
    } catch (error) {
      console.error("Location error:", error);
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
      !locationName.trim()
    ) {
      Toast.show({
        type: "error",
        text1: t("toast.error.missingFields"),
        text2: t("toast.error.fillRequired"),
      });
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

      if (coordinates) {
        formData.append("coordinates", JSON.stringify(coordinates));
      }

      // Add multiple images
      selectedImages.forEach((image, index) => {
        const uri = image.uri;
        const filename = uri.split("/").pop();
        const match = /\.([\w]+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";

        formData.append("images", {
          uri,
          name: filename,
          type,
        });
      });

      const res = await apiCall({
        method: "POST",
        url: `${baseUrl}/complaints`,
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const payload = res?.data;
      const ticketId = payload?.complaint?.ticketId || "";
      setCreatedTicket(ticketId);
      setShowSuccess(true);

      // Reset form
      setTitle("");
      setDescription("");
      setDepartment("Road");
      setLocationName("");
      setPriority("Medium");
      setSelectedImages([]);
      setCoordinates(null);
      setModalVisible(false);

      // Reload complaints
      load(false);
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

  const Input = ({ value, onChangeText, placeholder, multiline = false }) => (
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
        backgroundColor: colors.backgroundPrimary,
        minHeight: multiline ? 110 : 48,
        height: multiline ? undefined : 48,
        textAlignVertical: multiline ? "top" : "center",
      }}
    />
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("complaints.title")} hasBackButton={false} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <PressableBlock
          onPress={() => setModalVisible(true)}
          className="rounded-xl items-center justify-center py-3.5 flex-row mb-3"
          style={{ backgroundColor: colors.primary }}
        >
          <Plus size={20} color={colors.dark} />
          <Text
            className="text-base font-extrabold ml-2"
            style={{ color: colors.dark }}
          >
            {t("complaints.newComplaint")}
          </Text>
        </PressableBlock>
        <Card style={{ margin: 0, flex: 0 }}>
          <View
            className="flex-row items-center rounded-xl border px-3 py-2.5"
            style={{ borderColor: colors.border }}
          >
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("complaints.searchPlaceholder")}
              placeholderTextColor={colors.placeholder}
              className="ml-2 flex-1"
              style={{ color: colors.textPrimary }}
            />
          </View>

          <View className="flex-row mt-3">
            {["all", "pending", "in-progress", "resolved"].map((chip) => (
              <PressableBlock
                key={chip}
                onPress={() => setStatus(chip)}
                className="mr-2 px-3 py-[7px] rounded-xl border"
                style={{
                  borderColor: status === chip ? colors.primary : colors.border,
                  backgroundColor:
                    status === chip
                      ? `${colors.primary}22`
                      : colors.backgroundPrimary,
                }}
              >
                <Text
                  className="text-xs font-semibold capitalize"
                  style={{ color: colors.textPrimary }}
                >
                  {chip === "all" ? t("common.all") : formatStatusLabel(t, chip)}
                </Text>
              </PressableBlock>
            ))}
          </View>
        </Card>

        <AutoSkeleton isLoading={loading}>
          {filtered.length === 0 && !loading ? (
            <Card style={{ margin: 0, marginTop: 10, flex: 0 }}>
              <Text style={{ color: colors.textSecondary }}>
                {t("complaints.noComplaints")}
              </Text>
            </Card>
          ) : (
            filtered.map((c) => {
              const eta = formatEtaFromHours(
                c.estimatedCompletionTime,
                c.assignedAt,
                t("complaints.overdue"),
              );

              return (
                <Card key={c.id} style={{ margin: 0, marginTop: 10, flex: 0 }}>
                  {/* Top Row: Ticket and Date */}
                  <View className="flex-row justify-between mb-3">
                    <View className="flex-1 mr-2">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("complaints.ticket")}
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1"
                        style={{ color: colors.textPrimary }}
                      >
                        #{c.ticketId || "-"}
                      </Text>
                    </View>
                    <View className="flex-1 ml-2 items-end">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("complaints.date")}
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {formatDateShort(c.createdAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Second Row: Department and Status */}
                  <View className="flex-row justify-between mb-3">
                    <View className="flex-1 mr-2">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("complaints.details.department")}
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1 capitalize"
                        style={{ color: colors.textPrimary }}
                      >
                        {c.department || "-"}
                      </Text>
                    </View>
                    <View className="flex-1 ml-2 items-end">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("complaints.details.status")}
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1 capitalize"
                        style={{ color: getStatusColor(c.status, colors) }}
                      >
                        {formatStatusLabel(t, c.status)}
                      </Text>
                    </View>
                  </View>

                  {/* Third Row: Location and Priority */}
                  <View className="flex-row justify-between mb-3">
                    <View className="flex-1 mr-2">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("complaints.location")}
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {c.locationName || t("complaints.locationNotSet")}
                      </Text>
                    </View>
                    <View className="flex-1 ml-2 items-end">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("complaints.details.priority")}
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1"
                        style={{ color: getPriorityColor(c.priority, colors) }}
                      >
                        {formatPriorityLabel(t, c.priority)}
                      </Text>
                    </View>
                  </View>

                  {/* ETA Display - Prominent Badge */}
                  {c.estimatedCompletionTime && (
                    <View
                      className="mb-3 px-3 py-2.5 rounded-xl flex-row items-center justify-center"
                      style={{
                        backgroundColor:
                          eta === t("complaints.overdue")
                            ? "#FEE2E2"
                            : colors.info
                              ? colors.info + "20"
                              : "#DBEAFE",
                      }}
                    >
                      <Clock
                        size={18}
                        color={
                          eta === t("complaints.overdue")
                            ? "#EF4444"
                            : colors.info || "#3B82F6"
                        }
                      />
                      <Text
                        className="text-base font-bold ml-2"
                        style={{
                          color:
                            eta === t("complaints.overdue")
                              ? "#EF4444"
                              : colors.info || "#3B82F6",
                        }}
                      >
                        {t("complaints.expectedResolution")}:{" "}
                        {eta}
                      </Text>
                    </View>
                  )}

                  {/* Full Width: Description/Title */}
                  <View className="mb-3">
                    <Text
                      className="text-sm"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("complaints.description")}
                    </Text>
                    <Text
                      className="text-base mt-1"
                      style={{ color: colors.textPrimary }}
                    >
                      {c.title || t("complaints.complaint")}
                    </Text>
                  </View>

                  <PressableBlock
                    onPress={() =>
                      router.push(`/complaints/complaint-details?id=${c.id}`)
                    }
                    className="mt-1 rounded-lg items-center justify-center py-2.5"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <Text className="font-bold" style={{ color: colors.dark }}>
                      {t("complaints.open")}
                    </Text>
                  </PressableBlock>
                </Card>
              );
            })
          )}
        </AutoSkeleton>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          className="flex-1 justify-center items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View
            className="w-11/12 max-h-[85%] rounded-2xl"
            style={{ backgroundColor: colors.backgroundPrimary }}
          >
            <View
              className="flex-row items-center justify-between p-4 border-b"
              style={{ borderBottomColor: colors.border }}
            >
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                {t("complaints.newComplaint")}
              </Text>
              <PressableBlock
                onPress={() => setModalVisible(false)}
                className="px-3 py-1"
              >
                <Text
                  className="text-base font-bold"
                  style={{ color: colors.textSecondary }}
                >
                  ✕
                </Text>
              </PressableBlock>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <View className="mb-2.5">
                <Text
                  className="text-base font-bold mb-1"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.form.title")}
                </Text>
                <Input
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t("complaints.form.titlePlaceholder")}
                />
              </View>

              <View className="mb-2.5">
                <Text
                  className="text-base font-bold mb-1"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.form.description")}
                </Text>
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t("complaints.form.descriptionPlaceholder")}
                  multiline
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
                    backgroundColor: colors.backgroundPrimary,
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
                <Input
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder={t("complaints.form.locationPlaceholder")}
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
                    backgroundColor: colors.backgroundPrimary,
                    borderRadius: 12,
                    height: 48,
                  }}
                />
              </View>

              {/* GPS Location */}
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
                          color={
                            coordinates ? colors.primary : colors.textSecondary
                          }
                        />
                        <Text
                          className="text-sm font-semibold ml-2"
                          style={{
                            color: coordinates
                              ? colors.primary
                              : colors.textPrimary,
                          }}
                        >
                          {coordinates
                            ? `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`
                            : t("complaints.captureLocation")}
                        </Text>
                      </>
                    )}
                  </PressableBlock>
                  {coordinates && (
                    <PressableBlock
                      onPress={() => setCoordinates(null)}
                      className="ml-2 px-3 py-3 rounded-xl"
                      style={{ backgroundColor: colors.danger + "22" }}
                    >
                      <X size={18} color={colors.danger} />
                    </PressableBlock>
                  )}
                </View>
              </View>

              {/* Photo Upload */}
              <View className="mb-2.5">
                <Text
                  className="text-base font-bold mb-1"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.proofImages")}
                </Text>

                {/* Selected Images Preview */}
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

                {/* Image Selection Buttons */}
                {selectedImages.length < 5 && (
                  <View className="flex-row">
                    <PressableBlock
                      onPress={takePhoto}
                      className="flex-1 mr-2 flex-row items-center justify-center py-3 rounded-xl border"
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

                    <PressableBlock
                      onPress={pickImages}
                      className="flex-1 ml-2 flex-row items-center justify-center py-3 rounded-xl border"
                      style={{
                        borderColor: colors.border,
                        backgroundColor: colors.backgroundSecondary,
                      }}
                    >
                      <Plus size={18} color={colors.textPrimary} />
                      <Text
                        className="text-sm font-semibold ml-2"
                        style={{ color: colors.textPrimary }}
                      >
                        {t("complaints.choosePhotos")}
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
                  {saving
                    ? t("complaints.saving")
                    : t("complaints.submitComplaint")}
                </Text>
              </PressableBlock>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <DialogBox
        visible={showSuccess}
        title={t("complaints.complaintCreated")}
        message={
          createdTicket
            ? `${t("complaints.ticketLabel")}: ${createdTicket}`
            : t("complaints.savedSuccessfully")
        }
        confirmText={t("common.ok")}
        onConfirm={() => setShowSuccess(false)}
      />
    </View>
  );
}
