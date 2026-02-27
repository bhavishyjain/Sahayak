import { useRouter } from "expo-router";
import {
  Clock,
  MapPin,
  Filter,
  Calendar,
  X,
  ArrowUpDown,
  Search,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import { useTheme } from "../../../utils/context/theme";
import apiCall from "../../../utils/api";
import { getStatusColor, getPriorityColor } from "../../../utils/colorHelpers";
import { WORKER_ASSIGNED_URL } from "../../../url";

export default function WorkerAssigned() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState("old-to-new"); // "new-to-old" or "old-to-new"
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: WORKER_ASSIGNED_URL,
      });

      const data = res?.data?.complaints || [];
      setComplaints(data);
      setFilteredComplaints(data);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2:
          e?.response?.data?.message || "Could not load assigned complaints",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [
    startDate,
    endDate,
    sortOrder,
    selectedPriority,
    selectedStatus,
    searchQuery,
    complaints,
  ]);

  const applyFilters = () => {
    let filtered = [...complaints];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.ticketId?.toLowerCase().includes(query) ||
          c.title?.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.location?.toLowerCase().includes(query),
      );
    }

    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(
        (c) => new Date(c.assignedAt || c.createdAt) >= start,
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (c) => new Date(c.assignedAt || c.createdAt) <= end,
      );
    }

    // Priority filter
    if (selectedPriority !== "all") {
      filtered = filtered.filter((c) => c.priority === selectedPriority);
    }

    // Status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter((c) => c.status === selectedStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.assignedAt || a.createdAt);
      const dateB = new Date(b.assignedAt || b.createdAt);
      return sortOrder === "new-to-old" ? dateB - dateA : dateA - dateB;
    });

    setFilteredComplaints(filtered);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSortOrder("old-to-new");
    setSelectedPriority("all");
    setSelectedStatus("all");
    setSearchQuery("");
    setShowFilters(false);
  };

  const hasActiveFilters = () => {
    return (
      searchQuery.trim() ||
      startDate ||
      endDate ||
      sortOrder !== "old-to-new" ||
      selectedPriority !== "all" ||
      selectedStatus !== "all"
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            Loading assigned complaints...
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
      <BackButtonHeader title="Assigned Complaints" hasBackButton={false} />

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Search Bar */}
        {complaints.length > 0 && (
          <View className="mt-4 mb-2">
            <View
              className="flex-row items-center px-4 py-3 rounded-xl"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: searchQuery ? colors.primary : colors.border,
              }}
            >
              <Search
                size={20}
                color={searchQuery ? colors.primary : colors.textSecondary}
              />
              <TextInput
                className="ml-3 flex-1 text-base"
                style={{ color: colors.textPrimary }}
                placeholder="Search by ID, title, location..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery && (
                <PressableBlock onPress={() => setSearchQuery("")}>
                  <X size={18} color={colors.textSecondary} />
                </PressableBlock>
              )}
            </View>
          </View>
        )}

        {/* Stats Card */}
        {complaints.length > 0 && (
          <Card style={{ margin: 0, marginTop: 16, marginBottom: 16, flex: 0 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: colors.warning + "20" || "#F59E0B20",
                  }}
                >
                  <Clock size={24} color={colors.warning || "#F59E0B"} />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    Active Tasks
                  </Text>
                  <Text
                    className="text-2xl font-bold mt-1"
                    style={{ color: colors.textPrimary }}
                  >
                    {filteredComplaints.length}
                  </Text>
                </View>
              </View>
              <PressableBlock onPress={() => setShowFilters(!showFilters)}>
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{
                    backgroundColor:
                      showFilters || hasActiveFilters()
                        ? colors.primary + "20"
                        : colors.backgroundSecondary,
                  }}
                >
                  <Filter
                    size={20}
                    color={
                      showFilters || hasActiveFilters()
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                </View>
              </PressableBlock>
            </View>
          </Card>
        )}

        {/* Filters Section */}
        {showFilters && (
          <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-base font-bold"
                style={{ color: colors.textPrimary }}
              >
                Filters & Sorting
              </Text>
              {hasActiveFilters() && (
                <PressableBlock onPress={clearFilters}>
                  <View className="flex-row items-center">
                    <X size={16} color={colors.textSecondary} />
                    <Text
                      className="text-sm font-semibold ml-1"
                      style={{ color: colors.textSecondary }}
                    >
                      Clear All
                    </Text>
                  </View>
                </PressableBlock>
              )}
            </View>

            <View
              className="h-[1px] mb-3"
              style={{ backgroundColor: colors.border }}
            />

            {/* Sort Order */}
            <View className="mb-3">
              <Text
                className="text-xs font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                Sort By Date
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <PressableBlock
                  onPress={() => setSortOrder("new-to-old")}
                  style={{ flex: 1 }}
                >
                  <View
                    className="px-3 py-2 rounded-xl flex-row items-center justify-center"
                    style={{
                      backgroundColor:
                        sortOrder === "new-to-old"
                          ? colors.primary + "20"
                          : colors.backgroundPrimary,
                      borderWidth: 1,
                      borderColor:
                        sortOrder === "new-to-old"
                          ? colors.primary
                          : colors.border,
                    }}
                  >
                    <ArrowUpDown
                      size={14}
                      color={
                        sortOrder === "new-to-old"
                          ? colors.primary
                          : colors.textPrimary
                      }
                    />
                    <Text
                      className="text-xs font-semibold ml-1"
                      style={{
                        color:
                          sortOrder === "new-to-old"
                            ? colors.primary
                            : colors.textPrimary,
                      }}
                    >
                      Newest First
                    </Text>
                  </View>
                </PressableBlock>
                <PressableBlock
                  onPress={() => setSortOrder("old-to-new")}
                  style={{ flex: 1 }}
                >
                  <View
                    className="px-3 py-2 rounded-xl flex-row items-center justify-center"
                    style={{
                      backgroundColor:
                        sortOrder === "old-to-new"
                          ? colors.primary + "20"
                          : colors.backgroundPrimary,
                      borderWidth: 1,
                      borderColor:
                        sortOrder === "old-to-new"
                          ? colors.primary
                          : colors.border,
                    }}
                  >
                    <ArrowUpDown
                      size={14}
                      color={
                        sortOrder === "old-to-new"
                          ? colors.primary
                          : colors.textPrimary
                      }
                    />
                    <Text
                      className="text-xs font-semibold ml-1"
                      style={{
                        color:
                          sortOrder === "old-to-new"
                            ? colors.primary
                            : colors.textPrimary,
                      }}
                    >
                      Oldest First
                    </Text>
                  </View>
                </PressableBlock>
              </View>
            </View>

            {/* Date Range */}
            <View className="mb-3">
              <Text
                className="text-xs font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                Date Range
              </Text>
              <View className="flex-row" style={{ gap: 8 }}>
                <View className="flex-1">
                  <DateTimePickerModal
                    mode="date"
                    value={startDate}
                    onChange={setStartDate}
                    icon={Calendar}
                    placeholder="Start date"
                    maxDateToday={true}
                  />
                </View>
                <View className="flex-1">
                  <DateTimePickerModal
                    mode="date"
                    value={endDate}
                    onChange={setEndDate}
                    icon={Calendar}
                    placeholder="End date"
                    maxDateToday={true}
                  />
                </View>
              </View>
            </View>

            {/* Priority Filter */}
            <View className="mb-3">
              <Text
                className="text-xs font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                Priority
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {["all", "high", "medium", "low"].map((priority) => (
                  <PressableBlock
                    key={priority}
                    onPress={() => setSelectedPriority(priority)}
                  >
                    <View
                      className="px-3 py-2 rounded-xl"
                      style={{
                        backgroundColor:
                          selectedPriority === priority
                            ? colors.primary + "20"
                            : colors.backgroundPrimary,
                        borderWidth: 1,
                        borderColor:
                          selectedPriority === priority
                            ? colors.primary
                            : colors.border,
                      }}
                    >
                      <Text
                        className="text-xs font-semibold capitalize"
                        style={{
                          color:
                            selectedPriority === priority
                              ? colors.primary
                              : colors.textPrimary,
                        }}
                      >
                        {priority}
                      </Text>
                    </View>
                  </PressableBlock>
                ))}
              </View>
            </View>

            {/* Status Filter */}
            <View>
              <Text
                className="text-xs font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                Status
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {["all", "assigned", "in-progress", "resolved"].map(
                  (status) => (
                    <PressableBlock
                      key={status}
                      onPress={() => setSelectedStatus(status)}
                    >
                      <View
                        className="px-3 py-2 rounded-xl"
                        style={{
                          backgroundColor:
                            selectedStatus === status
                              ? colors.primary + "20"
                              : colors.backgroundPrimary,
                          borderWidth: 1,
                          borderColor:
                            selectedStatus === status
                              ? colors.primary
                              : colors.border,
                        }}
                      >
                        <Text
                          className="text-xs font-semibold capitalize"
                          style={{
                            color:
                              selectedStatus === status
                                ? colors.primary
                                : colors.textPrimary,
                          }}
                        >
                          {status.replace("-", " ")}
                        </Text>
                      </View>
                    </PressableBlock>
                  ),
                )}
              </View>
            </View>

            {filteredComplaints.length !== complaints.length && (
              <View
                className="mt-3 px-3 py-2 rounded-xl"
                style={{ backgroundColor: colors.info + "20" || "#3B82F620" }}
              >
                <Text
                  className="text-xs text-center"
                  style={{ color: colors.info || "#3B82F6" }}
                >
                  Showing {filteredComplaints.length} of {complaints.length}{" "}
                  tasks
                </Text>
              </View>
            )}
          </Card>
        )}

        {filteredComplaints.length === 0 && complaints.length > 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                No tasks found
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                Try adjusting your filters
              </Text>
            </View>
          </Card>
        ) : complaints.length === 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                No assigned complaints
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                You don't have any active complaints assigned to you
              </Text>
            </View>
          </Card>
        ) : (
          filteredComplaints.map((complaint) => (
            <PressableBlock
              key={complaint.id}
              onPress={() =>
                router.push(`/complaints/complaint-details?id=${complaint.id}`)
              }
            >
              <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                <View className="flex-row justify-between items-start mb-2">
                  <Text
                    className="text-lg font-bold flex-1"
                    style={{ color: colors.primary }}
                  >
                    #{complaint.ticketId}
                  </Text>
                  <View
                    className="px-2 py-1 rounded"
                    style={{
                      backgroundColor:
                        getStatusColor(complaint.status, colors) + "20",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold capitalize"
                      style={{
                        color: getStatusColor(complaint.status, colors),
                      }}
                    >
                      {complaint.status}
                    </Text>
                  </View>
                </View>

                <Text
                  className="text-base font-semibold mb-1"
                  style={{ color: colors.textPrimary }}
                >
                  {complaint.title}
                </Text>

                <Text
                  className="text-sm mb-3 leading-5"
                  numberOfLines={2}
                  style={{ color: colors.textSecondary }}
                >
                  {complaint.description}
                </Text>

                <View className="flex-row items-center mb-2">
                  <MapPin size={14} color={colors.textSecondary} />
                  <Text
                    className="text-xs ml-1 flex-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {complaint.locationName || "No location"}
                  </Text>
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Clock size={14} color={colors.textSecondary} />
                    <Text
                      className="text-xs ml-1"
                      style={{ color: colors.textSecondary }}
                    >
                      Assigned {formatDate(complaint.assignedAt)}
                    </Text>
                  </View>
                  <View
                    className="px-2 py-1 rounded"
                    style={{
                      backgroundColor:
                        getPriorityColor(complaint.priority, colors) + "20",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{
                        color: getPriorityColor(complaint.priority, colors),
                      }}
                    >
                      {complaint.priority}
                    </Text>
                  </View>
                </View>
                {complaint.estimatedCompletionTime && (
                  <View
                    className="mt-3 px-3 py-2 rounded-xl flex-row items-center justify-center"
                    style={{
                      backgroundColor:
                        formatETA(complaint.estimatedCompletionTime) ===
                        "Overdue"
                          ? "#FEE2E2"
                          : colors.info
                            ? colors.info + "20"
                            : "#DBEAFE",
                    }}
                  >
                    <Clock
                      size={16}
                      color={
                        formatETA(complaint.estimatedCompletionTime) ===
                        "Overdue"
                          ? "#EF4444"
                          : colors.info || "#3B82F6"
                      }
                    />
                    <Text
                      className="text-sm font-bold ml-2"
                      style={{
                        color:
                          formatETA(complaint.estimatedCompletionTime) ===
                          "Overdue"
                            ? "#EF4444"
                            : colors.info || "#3B82F6",
                      }}
                    >
                      ETA: {formatETA(complaint.estimatedCompletionTime)}
                    </Text>
                  </View>
                )}
              </Card>
            </PressableBlock>
          ))
        )}
      </ScrollView>
    </View>
  );
}
