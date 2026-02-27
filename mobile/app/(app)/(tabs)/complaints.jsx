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
import { useTheme } from "../../../utils/context/theme";
import { API_BASE } from "../../../url";

export default function Complaints() {
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
  const [department, setDepartment] = useState("road");
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
    { label: "Road", value: "Road" },
    { label: "Water", value: "Water" },
    { label: "Electricity", value: "Electricity" },
    { label: "Sanitation", value: "Sanitation" },
    { label: "Other", value: "other" },
  ];

  const PRIORITY_OPTIONS = [
    { label: "Low", value: "Low" },
    { label: "Medium", value: "Medium" },
    { label: "High", value: "High" },
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
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not load complaints.",
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
          text1: "Permission Denied",
          text2: "Camera roll permission is required",
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
            text1: "Too Many Images",
            text2: "Maximum 5 images allowed",
          });
          return;
        }
        setSelectedImages([...selectedImages, ...result.assets]);
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Could not select images",
      });
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: "Permission Denied",
          text2: "Camera permission is required",
        });
        return;
      }

      if (selectedImages.length >= 5) {
        Toast.show({
          type: "error",
          text1: "Maximum Reached",
          text2: "You can only upload 5 images",
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
        text1: "Error",
        text2: "Could not take photo",
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
          text1: "Permission Denied",
          text2: "Location permission is required",
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
        text1: "Location Captured",
        text2: `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`,
      });
    } catch (error) {
      console.error("Location error:", error);
      Toast.show({
        type: "error",
        text1: "Location Error",
        text2: "Could not get current location",
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
        text1: "Missing fields",
        text2: "Please fill required details.",
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
      setDepartment("road");
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
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not create complaint.",
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
      <BackButtonHeader title="Complaints" hasBackButton={false} />

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
            New Complaint
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
              placeholder="Search by ticket, department, location"
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
                  {chip}
                </Text>
              </PressableBlock>
            ))}
          </View>
        </Card>

        <AutoSkeleton isLoading={loading}>
          {filtered.length === 0 && !loading ? (
            <Card style={{ margin: 0, marginTop: 10, flex: 0 }}>
              <Text style={{ color: colors.textSecondary }}>
                No complaints found.
              </Text>
            </Card>
          ) : (
            filtered.map((c) => {
              const formatDate = (dateString) => {
                if (!dateString) return "-";
                const date = new Date(dateString);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
              };

              const formatETA = (etaDate) => {
                if (!etaDate) return null;
                const eta = new Date(etaDate);
                const now = new Date();
                const diffMs = eta - now;
                const diffHours = Math.round(diffMs / (1000 * 60 * 60));

                if (diffHours < 0) return "Overdue";
                if (diffHours < 24) return `${diffHours}h`;
                const diffDays = Math.round(diffHours / 24);
                return `${diffDays}d`;
              };

              return (
                <Card key={c.id} style={{ margin: 0, marginTop: 10, flex: 0 }}>
                  {/* Top Row: Ticket and Date */}
                  <View className="flex-row justify-between mb-3">
                    <View className="flex-1 mr-2">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        Ticket
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
                        Date
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {formatDate(c.createdAt)}
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
                        Department
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
                        Status
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1 capitalize"
                        style={{ color: getStatusColor(c.status, colors) }}
                      >
                        {c.status || "-"}
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
                        Location
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {c.locationName || "Location not set"}
                      </Text>
                    </View>
                    <View className="flex-1 ml-2 items-end">
                      <Text
                        className="text-sm"
                        style={{ color: colors.textSecondary }}
                      >
                        Priority
                      </Text>
                      <Text
                        className="text-base font-semibold mt-1"
                        style={{ color: getPriorityColor(c.priority, colors) }}
                      >
                        {c.priority || "-"}
                      </Text>
                    </View>
                  </View>

                  {/* ETA Display - Prominent Badge */}
                  {c.estimatedCompletionTime && (
                    <View
                      className="mb-3 px-3 py-2.5 rounded-xl flex-row items-center justify-center"
                      style={{
                        backgroundColor:
                          formatETA(c.estimatedCompletionTime) === "Overdue"
                            ? "#FEE2E2"
                            : colors.info
                              ? colors.info + "20"
                              : "#DBEAFE",
                      }}
                    >
                      <Clock
                        size={18}
                        color={
                          formatETA(c.estimatedCompletionTime) === "Overdue"
                            ? "#EF4444"
                            : colors.info || "#3B82F6"
                        }
                      />
                      <Text
                        className="text-base font-bold ml-2"
                        style={{
                          color:
                            formatETA(c.estimatedCompletionTime) === "Overdue"
                              ? "#EF4444"
                              : colors.info || "#3B82F6",
                        }}
                      >
                        Expected Resolution:{" "}
                        {formatETA(c.estimatedCompletionTime)}
                      </Text>
                    </View>
                  )}

                  {/* Full Width: Description/Title */}
                  <View className="mb-3">
                    <Text
                      className="text-sm"
                      style={{ color: colors.textSecondary }}
                    >
                      Description
                    </Text>
                    <Text
                      className="text-base mt-1"
                      style={{ color: colors.textPrimary }}
                    >
                      {c.title || "Complaint"}
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
                      Open
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
                New Complaint
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
                  Title
                </Text>
                <Input
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter title"
                />
              </View>

              <View className="mb-2.5">
                <Text
                  className="text-base font-bold mb-1"
                  style={{ color: colors.textPrimary }}
                >
                  Description
                </Text>
                <Input
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter description"
                  multiline
                />
              </View>

              <View className="mb-2.5">
                <Text
                  className="text-base font-bold mb-1"
                  style={{ color: colors.textPrimary }}
                >
                  Department
                </Text>
                <CustomPicker
                  data={DEPARTMENT_OPTIONS}
                  value={department}
                  onChange={(item) => setDepartment(item.value)}
                  placeholder="Select department"
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
                  Location
                </Text>
                <Input
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="Enter location name"
                />
              </View>

              <View className="mb-2.5">
                <Text
                  className="text-base font-bold mb-1"
                  style={{ color: colors.textPrimary }}
                >
                  Priority
                </Text>
                <CustomPicker
                  data={PRIORITY_OPTIONS}
                  value={priority}
                  onChange={(item) => setPriority(item.value)}
                  placeholder="Select priority"
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
                  GPS Coordinates (Optional)
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
                            : "Capture Location"}
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
                  Proof Images (Optional, Max 5)
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
                        Take Photo
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
                        Choose Photos
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
                  {saving ? "Saving..." : "Submit complaint"}
                </Text>
              </PressableBlock>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <DialogBox
        visible={showSuccess}
        title="Complaint created"
        message={
          createdTicket ? `Ticket: ${createdTicket}` : "Saved successfully"
        }
        confirmText="OK"
        onConfirm={() => setShowSuccess(false)}
      />
    </View>
  );
}
