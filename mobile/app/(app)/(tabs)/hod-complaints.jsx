import { useRouter } from "expo-router";
import {
  AlertCircle,
  MapPin,
  CheckCircle,
  XCircle,
  Search,
  ThumbsUp,
  Clock,
  CheckSquare,
  Square,
  Users,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import StatusPill from "../../../components/StatusPill";
import CustomPicker from "../../../components/CustomPicker";
import {
  HOD_DASHBOARD_URL,
  HOD_BULK_ASSIGN_URL,
  HOD_WORKERS_URL,
} from "../../../url";
import apiCall from "../../../utils/api";
import { getPriorityColor } from "../../../utils/colorHelpers";
import { useTheme } from "../../../utils/context/theme";

export default function HodComplaints() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkAssignModalVisible, setBulkAssignModalVisible] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [workerSearchQuery, setWorkerSearchQuery] = useState("");

  const filteredComplaints = complaints.filter((complaint) => {
    const query = searchQuery.toLowerCase();
    return (
      complaint.ticketId?.toLowerCase().includes(query) ||
      complaint.title?.toLowerCase().includes(query) ||
      complaint.description?.toLowerCase().includes(query) ||
      complaint.locationName?.toLowerCase().includes(query)
    );
  });

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: HOD_DASHBOARD_URL,
      });

      setComplaints(res?.data?.complaints || []);
      setStats(res?.data?.stats || null);
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

  const loadWorkers = async () => {
    try {
      const res = await apiCall({
        method: "GET",
        url: HOD_WORKERS_URL,
      });
      console.log("Workers API Response:", JSON.stringify(res?.data, null, 2));
      console.log("Number of workers:", res?.data?.workers?.length);
      setWorkers(res?.data?.workers || []);
    } catch (e) {
      console.error("Error loading workers:", e);
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: "Could not load workers",
      });
    }
  };

  useEffect(() => {
    load(false);
    loadWorkers();
  }, []);

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedComplaints([]);
  };

  const toggleSelectComplaint = (complaintId) => {
    if (selectedComplaints.includes(complaintId)) {
      setSelectedComplaints(
        selectedComplaints.filter((id) => id !== complaintId),
      );
    } else {
      setSelectedComplaints([...selectedComplaints, complaintId]);
    }
  };

  const selectAll = () => {
    const unassignedIds = filteredComplaints
      .filter((c) => !c.assignedTo)
      .map((c) => c.id);
    setSelectedComplaints(unassignedIds);
  };

  const deselectAll = () => {
    setSelectedComplaints([]);
  };

  const handleBulkAssign = async () => {
    if (!selectedWorker) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Please select a worker",
      });
      return;
    }

    try {
      setBulkAssigning(true);
      await apiCall({
        method: "POST",
        url: HOD_BULK_ASSIGN_URL,
        data: {
          complaintIds: selectedComplaints,
          workerId: selectedWorker,
        },
      });

      Toast.show({
        type: "success",
        text1: "Success",
        text2: `${selectedComplaints.length} complaints assigned successfully`,
      });

      setBulkAssignModalVisible(false);
      setSelectedComplaints([]);
      setSelectMode(false);
      setSelectedWorker("");
      load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not assign complaints",
      });
    } finally {
      setBulkAssigning(false);
    }
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

  const onRefresh = () => {
    load(true);
  };

  const renderComplaintItem = ({ item }) => {
    const isSelected = selectedComplaints.includes(item.id);
    const canSelect = selectMode && !item.assignedTo;
    const eta = formatETA(item.estimatedCompletionTime);

    return (
      <View className="flex-row items-center mb-3">
        {selectMode && (
          <TouchableOpacity
            onPress={() => canSelect && toggleSelectComplaint(item.id)}
            disabled={!canSelect}
            className="mr-3"
          >
            {canSelect ? (
              isSelected ? (
                <CheckSquare size={24} color={colors.primary} />
              ) : (
                <Square size={24} color={colors.textSecondary} />
              )
            ) : (
              <Square size={24} color={colors.border} />
            )}
          </TouchableOpacity>
        )}

        <PressableBlock
          onPress={() =>
            router.push(`/complaints/complaint-details?id=${item.id}`)
          }
          style={{ flex: 1 }}
        >
          <Card style={{ margin: 0, flex: 0 }}>
            <View className="flex-row items-start justify-between mb-2">
              <Text
                className="text-base font-bold"
                style={{ color: colors.primary }}
              >
                #{item.ticketId}
              </Text>
              <StatusPill status={item.status} />
            </View>

            <Text
              className="text-base font-semibold mb-2"
              style={{ color: colors.textPrimary }}
            >
              {item.title}
            </Text>

            <Text
              className="text-sm mb-3"
              style={{ color: colors.textSecondary }}
              numberOfLines={2}
            >
              {item.description}
            </Text>

            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center flex-1">
                <MapPin size={14} color={colors.textSecondary} />
                <Text
                  className="text-xs ml-1 flex-1"
                  style={{ color: colors.textSecondary }}
                  numberOfLines={1}
                >
                  {item.locationName}
                </Text>
              </View>

              <View className="flex-row items-center ml-3">
                {item.assignedTo ? (
                  <>
                    <CheckCircle
                      size={14}
                      color={colors.success || "#10B981"}
                    />
                    <Text
                      className="text-xs ml-1 font-semibold"
                      style={{ color: colors.success || "#10B981" }}
                    >
                      Assigned
                    </Text>
                  </>
                ) : (
                  <>
                    <AlertCircle
                      size={14}
                      color={colors.warning || "#F59E0B"}
                    />
                    <Text
                      className="text-xs ml-1 font-semibold"
                      style={{ color: colors.warning || "#F59E0B" }}
                    >
                      Unassigned
                    </Text>
                  </>
                )}
              </View>
            </View>

            <View className="flex-row items-center justify-between mt-2">
              <View className="flex-row items-center">
                <View
                  className="px-2 py-1 rounded"
                  style={{
                    backgroundColor:
                      getPriorityColor(item.priority, colors) + "20",
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{
                      color: getPriorityColor(item.priority, colors),
                    }}
                  >
                    {item.priority}
                  </Text>
                </View>
                <View className="flex-row items-center ml-2">
                  <ThumbsUp size={12} color={colors.textSecondary} />
                  <Text
                    className="text-xs ml-1 font-medium"
                    style={{ color: colors.textSecondary }}
                  >
                    {item.upvoteCount || 0}
                  </Text>
                </View>
                {eta && (
                  <View className="flex-row items-center ml-2">
                    <Clock
                      size={12}
                      color={
                        eta === "Overdue" ? "#EF4444" : colors.info || "#3B82F6"
                      }
                    />
                    <Text
                      className="text-xs ml-1 font-semibold"
                      style={{
                        color:
                          eta === "Overdue"
                            ? "#EF4444"
                            : colors.info || "#3B82F6",
                      }}
                    >
                      ETA: {eta}
                    </Text>
                  </View>
                )}
              </View>

              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {new Date(item.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
          </Card>
        </PressableBlock>
      </View>
    );
  };

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title="Manage Complaints" hasBackButton={false} />

        {/* Search Bar */}
        <View className="px-4 pb-4 pt-4">
          <View
            className="flex-row items-center px-4 py-3.5 rounded-2xl"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1.5,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              className="flex-1 ml-3 text-base"
              style={{ color: colors.textPrimary }}
              placeholder="Search by ticket ID, title or location..."
              placeholderTextColor={colors.textSecondary}
              editable={false}
            />
          </View>
        </View>

        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            Loading complaints...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title="Manage Complaints" hasBackButton={false} />

      {/* Search Bar */}
      <View className="px-4 pb-4 pt-4">
        <View
          className="flex-row items-center px-4 py-3.5 rounded-2xl"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1.5,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            className="flex-1 ml-3 text-base"
            style={{ color: colors.textPrimary }}
            placeholder="Search by ticket ID, title or location..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Bulk Select Controls */}
      <View className="px-4 pb-2">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={toggleSelectMode}
            className="flex-row items-center px-4 py-2 rounded-xl"
            style={{
              backgroundColor: selectMode
                ? colors.primary + "20"
                : colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: selectMode ? colors.primary : colors.border,
            }}
          >
            <CheckSquare
              size={18}
              color={selectMode ? colors.primary : colors.textSecondary}
            />
            <Text
              className="text-sm font-semibold ml-2"
              style={{
                color: selectMode ? colors.primary : colors.textSecondary,
              }}
            >
              {selectMode ? "Cancel" : "Bulk Select"}
            </Text>
          </TouchableOpacity>

          {selectMode && (
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={selectAll}
                className="px-3 py-2 rounded-xl mr-2"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: colors.textSecondary }}
                >
                  Select All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={deselectAll}
                className="px-3 py-2 rounded-xl mr-2"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: colors.textSecondary }}
                >
                  Clear
                </Text>
              </TouchableOpacity>

              {selectedComplaints.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setBulkAssignModalVisible(true);
                    setWorkerSearchQuery("");
                  }}
                  className="flex-row items-center px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: colors.primary,
                  }}
                >
                  <Users size={16} color="#fff" />
                  <Text
                    className="text-xs font-bold ml-1.5"
                    style={{ color: "#fff" }}
                  >
                    Assign ({selectedComplaints.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={filteredComplaints}
        renderItem={renderComplaintItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <AlertCircle size={48} color={colors.textSecondary} />
            <Text
              className="text-base mt-3 text-center"
              style={{ color: colors.textSecondary }}
            >
              {searchQuery
                ? "No complaints found"
                : "No complaints in your department"}
            </Text>
          </View>
        }
      />

      {/* Bulk Assign Modal */}
      <Modal
        visible={bulkAssignModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBulkAssignModalVisible(false)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View
            className="rounded-t-3xl p-6"
            style={{
              backgroundColor: colors.backgroundPrimary,
              maxHeight: "80%",
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className="text-xl font-bold"
                style={{ color: colors.textPrimary }}
              >
                Bulk Assign Complaints
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setBulkAssignModalVisible(false);
                  setWorkerSearchQuery("");
                }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              className="p-4 rounded-2xl mb-4"
              style={{ backgroundColor: colors.primary + "10" }}
            >
              <Text
                className="text-sm font-semibold mb-1"
                style={{ color: colors.primary }}
              >
                {selectedComplaints.length} Complaints Selected
              </Text>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                Select a worker to assign all selected complaints
              </Text>
            </View>

            {/* Worker Search */}
            <View className="mb-3">
              <View
                className="flex-row items-center px-4 py-3 rounded-xl"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Search size={18} color={colors.textSecondary} />
                <TextInput
                  className="flex-1 ml-2 text-sm"
                  style={{ color: colors.textPrimary }}
                  placeholder="Search workers..."
                  placeholderTextColor={colors.textSecondary}
                  value={workerSearchQuery}
                  onChangeText={setWorkerSearchQuery}
                />
                {workerSearchQuery && (
                  <TouchableOpacity onPress={() => setWorkerSearchQuery("")}>
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Worker List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 400 }}
            >
              {workers.length === 0 ? (
                <View className="py-8 items-center">
                  <AlertCircle size={48} color={colors.textSecondary} />
                  <Text
                    className="text-sm mt-3 text-center"
                    style={{ color: colors.textSecondary }}
                  >
                    No workers available
                  </Text>
                </View>
              ) : (
                workers
                  .filter((w) =>
                    w.fullName
                      ?.toLowerCase()
                      .includes(workerSearchQuery.toLowerCase()),
                  )
                  .map((worker) => (
                    <TouchableOpacity
                      key={worker.id}
                      onPress={() => setSelectedWorker(worker.id)}
                      className="mb-2"
                    >
                      <View
                        className="p-4 rounded-xl flex-row items-center justify-between"
                        style={{
                          backgroundColor:
                            selectedWorker === worker.id
                              ? colors.primary + "20"
                              : colors.backgroundSecondary,
                          borderWidth: 1.5,
                          borderColor:
                            selectedWorker === worker.id
                              ? colors.primary
                              : colors.border,
                        }}
                      >
                        <View className="flex-1">
                          <Text
                            className="text-base font-semibold mb-1"
                            style={{
                              color:
                                selectedWorker === worker.id
                                  ? colors.primary
                                  : colors.textPrimary,
                            }}
                          >
                            {worker.fullName}
                          </Text>
                          <Text
                            className="text-xs"
                            style={{ color: colors.textSecondary }}
                          >
                            {worker.specializations?.join(", ") ||
                              "General worker"}
                          </Text>
                        </View>

                        {selectedWorker === worker.id && (
                          <CheckCircle size={24} color={colors.primary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))
              )}
            </ScrollView>

            <View className="flex-row mt-4">
              <TouchableOpacity
                onPress={() => {
                  setBulkAssignModalVisible(false);
                  setWorkerSearchQuery("");
                }}
                className="flex-1 py-4 rounded-2xl mr-2"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  className="text-center text-base font-semibold"
                  style={{ color: colors.textSecondary }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBulkAssign}
                disabled={bulkAssigning || !selectedWorker}
                className="flex-1 py-4 rounded-2xl ml-2"
                style={{
                  backgroundColor:
                    bulkAssigning || !selectedWorker
                      ? colors.border
                      : colors.primary,
                  opacity: bulkAssigning || !selectedWorker ? 0.6 : 1,
                }}
              >
                {bulkAssigning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    className="text-center text-base font-bold"
                    style={{ color: "#fff" }}
                  >
                    Assign All
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
