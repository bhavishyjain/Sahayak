import { useRouter } from "expo-router";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Camera,
  X,
  Navigation,
} from "lucide-react-native";
import { useEffect, useState } from "react";
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
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import ComplaintCard from "../../../components/ComplaintCard";
import FilterPanel from "../../../components/FilterPanel";
import SearchBar from "../../../components/SearchBar";
import CustomPicker from "../../../components/CustomPicker";
import DialogBox from "../../../components/DialogBox";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { formatPriorityLabel } from "../../../utils/complaintFormatters";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { API_BASE } from "../../../url";
import TEMPLATES from "../../../assets/data/complaint-templates.json";
import { useNetworkStatus } from "../../../utils/useNetworkStatus";
import {
  cacheComplaints,
  getCachedComplaints,
} from "../../../utils/complaintsCache";
import { enqueue, getQueue, dequeue } from "../../../utils/offlineQueue";

export default function Complaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const { isOnline } = useNetworkStatus();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("new-to-old");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
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
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);

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

  const LIMIT = 10;
  const STATUS_OPTIONS = [
    "pending",
    "assigned",
    "in-progress",
    "pending-approval",
    "needs-rework",
    "cancelled",
  ];

  const buildQuery = (currentPage) => {
    const params = new URLSearchParams();
    params.set("scope", "all");
    params.set("excludeStatus", "resolved");
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (departmentFilter !== "all") params.set("department", departmentFilter);
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    params.set("sort", sortOrder);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    params.set("page", currentPage);
    params.set("limit", LIMIT);
    return params.toString();
  };

  const load = async (pull = false, reset = false, requestedPage = null) => {
    const currentPage = requestedPage ?? (reset || pull ? 1 : page);
    try {
      if (pull) setRefreshing(true);
      else if (reset) setLoading(true);
      else setLoadingMore(true);

      if (!isOnline) {
        const cached = await getCachedComplaints(statusFilter);
        if (cached) setComplaints(cached);
        return;
      }

      const res = await apiCall({
        method: "GET",
        url: `${baseUrl}/complaints?${buildQuery(currentPage)}`,
      });
      const payload = res?.data;
      const fetched = payload?.complaints || [];
      const pages = payload?.pages ?? 1;

      if (reset || pull) {
        setComplaints(fetched);
        setPage(1);
      } else {
        setComplaints((prev) => {
          const merged = [...prev, ...fetched];
          const seen = new Set();
          return merged.filter((item) => {
            const key = item?.id || item?._id || item?.ticketId;
            if (!key) return true;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
        setPage(currentPage);
      }
      setTotalCount(payload?.total ?? 0);
      setHasMore(currentPage < pages);

      if (reset || pull) {
        await cacheComplaints(statusFilter, fetched);
      }

      // Flush offline queue when back online
      const queue = await getQueue();
      if (queue.length > 0 && (reset || pull)) {
        for (const entry of queue) {
          try {
            const formData = new FormData();
            formData.append("title", entry.title || "");
            formData.append("description", entry.description || "");
            formData.append("department", entry.department || "Other");
            formData.append("locationName", entry.locationName || "");
            formData.append("priority", entry.priority || "Medium");
            if (entry.coordinates) {
              formData.append("coordinates", JSON.stringify(entry.coordinates));
            }
            (entry.images || []).forEach((img) => {
              const filename = img.uri?.split("/").pop();
              const match = /\.(\w+)$/.exec(filename || "");
              const type = match ? `image/${match[1]}` : "image/jpeg";
              formData.append("images", { uri: img.uri, name: filename, type });
            });
            await apiCall({
              method: "POST",
              url: `${baseUrl}/complaints`,
              data: formData,
              headers: { "Content-Type": "multipart/form-data" },
            });
            await dequeue(entry.localId);
            Toast.show({
              type: "success",
              text1: t("complaints.queuedSubmittedTitle"),
              text2: `"${entry.title}" ${t("complaints.queuedSubmittedMessage")}`,
            });
          } catch {
            // leave in queue for next retry
          }
        }
        // Reload after flushing
        const res2 = await apiCall({
          method: "GET",
          url: `${baseUrl}/complaints?${buildQuery(1)}`,
        });
        const fresh = res2?.data?.complaints || [];
        setComplaints(fresh);
        setPage(1);
        setHasMore(1 < (res2?.data?.pages ?? 1));
        await cacheComplaints(statusFilter, fresh);
      }
    } catch (e) {
      const cached = await getCachedComplaints(statusFilter);
      if (cached) {
        setComplaints(cached);
      } else {
        Toast.show({
          type: "error",
          text1: t("toast.error.failed"),
          text2:
            e?.response?.data?.message || t("toast.error.loadComplaintsFailed"),
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    const nextPage = page + 1;
    load(false, false, nextPage);
  };

  useEffect(() => {
    load(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    statusFilter,
    departmentFilter,
    priorityFilter,
    sortOrder,
    startDate,
    endDate,
    searchQuery,
  ]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    departmentFilter !== "all" ||
    priorityFilter !== "all" ||
    sortOrder !== "new-to-old" ||
    !!startDate ||
    !!endDate;

  const clearFilters = () => {
    setStatusFilter("all");
    setDepartmentFilter("all");
    setPriorityFilter("all");
    setSortOrder("new-to-old");
    setStartDate("");
    setEndDate("");
  };

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

    // Offline: save to queue and show feedback
    if (!isOnline) {
      await enqueue({
        title: title.trim(),
        description: description.trim(),
        department: department.trim(),
        locationName: locationName.trim(),
        priority,
        coordinates: coordinates || null,
        images: selectedImages.map((img) => ({ uri: img.uri })),
      });
      Toast.show({
        type: "info",
        text1: t("complaints.offlineSavedTitle"),
        text2: t("complaints.offlineSavedMessage"),
      });
      setTitle("");
      setDescription("");
      setDepartment("Road");
      setLocationName("");
      setPriority("Medium");
      setSelectedImages([]);
      setCoordinates(null);
      setTemplatePickerVisible(false);
      setModalVisible(false);
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
      setTemplatePickerVisible(false);
      setModalVisible(false);

      // Reload complaints
      load(false, true);
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
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <View className="flex-1">
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("complaints.searchPlaceholder")}
            />
          </View>
          <FilterPanel
            variant="icon"
            statusOptions={STATUS_OPTIONS}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            departmentFilter={departmentFilter}
            setDepartmentFilter={setDepartmentFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            startDate={startDate}
            endDate={endDate}
            setStartDate={setStartDate}
            setEndDate={setEndDate}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            t={t}
            formatPriorityLabel={formatPriorityLabel}
          />
        </View>

        {loading ? (
          <Card style={{ margin: 0, marginTop: 10, flex: 0 }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </Card>
        ) : complaints.length === 0 ? (
          <Card style={{ margin: 0, marginTop: 10, flex: 0 }}>
            <Text style={{ color: colors.textSecondary }}>
              {t("complaints.noComplaints")}
            </Text>
          </Card>
        ) : (
          complaints.map((c, index) => (
            <ComplaintCard
              key={`${c.id || c._id || c.ticketId || "complaint"}-${index}`}
              complaint={c}
              onOpen={() =>
                router.push(`/complaints/complaint-details?id=${c.id || c._id}`)
              }
            />
          ))
        )}

        {/* Load More */}
        {hasMore && (
          <PressableBlock
            onPress={loadMore}
            disabled={loadingMore}
            className="mt-4 mb-2 rounded-xl items-center justify-center py-3"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: loadingMore ? 0.6 : 1,
            }}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.textSecondary }}
              >
                {t("complaints.loadMoreCount", {
                  current: complaints.length,
                  total: totalCount,
                })}
              </Text>
            )}
          </PressableBlock>
        )}
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
                <X size={20} color={colors.textSecondary} />
              </PressableBlock>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Quick Template Picker */}
              <View className="mb-3">
                <Text
                  className="text-base font-bold mb-1.5"
                  style={{ color: colors.textPrimary }}
                >
                  {t("complaints.templates.sectionTitle")}
                </Text>
                <PressableBlock
                  onPress={() =>
                    setTemplatePickerVisible(!templatePickerVisible)
                  }
                  className="flex-row items-center justify-between px-3 py-3 rounded-xl border"
                  style={{
                    borderColor: templatePickerVisible
                      ? colors.primary
                      : colors.border,
                    backgroundColor: templatePickerVisible
                      ? colors.primary + "15"
                      : colors.backgroundSecondary,
                  }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: templatePickerVisible
                        ? colors.primary
                        : colors.textSecondary,
                    }}
                  >
                    {templatePickerVisible
                      ? t("complaints.templates.collapse")
                      : t("complaints.templates.expand")}
                    {templatePickerVisible ? (
                      <ChevronUp size={16} color={colors.primary} />
                    ) : (
                      <ChevronDown size={16} color={colors.textSecondary} />
                    )}
                  </Text>
                </PressableBlock>

                {templatePickerVisible && (
                  <View
                    className="mt-1.5 rounded-xl border overflow-hidden"
                    style={{ borderColor: colors.border }}
                  >
                    {(TEMPLATES[department] || []).map((tpl, idx) => (
                      <PressableBlock
                        key={idx}
                        onPress={() => {
                          setTitle(tpl.title);
                          setDescription(tpl.description);
                          setPriority(tpl.priority);
                          setTemplatePickerVisible(false);
                        }}
                        className="px-4 py-3 border-b"
                        style={{
                          borderBottomColor: colors.border,
                          borderBottomWidth:
                            idx === (TEMPLATES[department] || []).length - 1
                              ? 0
                              : 1,
                          backgroundColor: colors.backgroundSecondary,
                        }}
                      >
                        <View className="flex-row items-center justify-between">
                          <Text
                            className="text-sm font-semibold flex-1 mr-2"
                            style={{ color: colors.textPrimary }}
                          >
                            {tpl.title}
                          </Text>
                          <View
                            className="px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor:
                                tpl.priority === "High"
                                  ? colors.danger + "22"
                                  : tpl.priority === "Medium"
                                    ? colors.warning + "22"
                                    : colors.success + "22",
                            }}
                          >
                            <Text
                              className="text-[10px] font-bold"
                              style={{
                                color:
                                  tpl.priority === "High"
                                    ? colors.danger
                                    : tpl.priority === "Medium"
                                      ? colors.warning
                                      : colors.success,
                              }}
                            >
                              {t(
                                `complaints.priority.${tpl.priority.toLowerCase()}`,
                              )}
                            </Text>
                          </View>
                        </View>
                        <Text
                          className="text-xs mt-0.5"
                          numberOfLines={1}
                          style={{ color: colors.textSecondary }}
                        >
                          {tpl.description}
                        </Text>
                      </PressableBlock>
                    ))}
                  </View>
                )}
              </View>

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
                  onChange={(item) => {
                    setDepartment(item.value);
                    setTemplatePickerVisible(false);
                  }}
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
