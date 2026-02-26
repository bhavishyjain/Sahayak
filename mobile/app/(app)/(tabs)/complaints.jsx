import { useRouter } from "expo-router";
import { Search, Plus } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
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

export default function ComplaintsScreen() {
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

  const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:6000/api";

  const DEPARTMENT_OPTIONS = [
    { label: "Road", value: "road" },
    { label: "Water", value: "water" },
    { label: "Electricity", value: "electricity" },
    { label: "Sanitation", value: "sanitation" },
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
      setComplaints(res?.data?.complaints || []);
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
      const res = await apiCall({
        method: "POST",
        url: `${baseUrl}/complaints`,
        data: {
          title: title.trim(),
          description: description.trim(),
          department: department.trim(),
          locationName: locationName.trim(),
          priority,
        },
      });

      const ticketId = res?.data?.complaint?.ticketId || "";
      setCreatedTicket(ticketId);
      setShowSuccess(true);

      // Reset form
      setTitle("");
      setDescription("");
      setDepartment("road");
      setLocationName("");
      setPriority("Medium");
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
