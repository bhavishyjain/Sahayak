import { useRouter } from "expo-router";
import {
  AlertCircle,
  MapPin,
  CheckCircle,
  Search,
  ThumbsUp,
  Clock,
  CheckSquare,
  Square,
  Users,
  X,
  Filter,
  Calendar,
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
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import PressableBlock from "../../../components/PressableBlock";
import SlaStatusBadge from "../../../components/SlaStatusBadge";
import StatusPill from "../../../components/StatusPill";
import {
  HOD_OVERVIEW_URL,
  HOD_ASSIGN_MULTIPLE_WORKERS_URL,
  HOD_WORKERS_URL,
} from "../../../url";
import apiCall from "../../../utils/api";
import { getPriorityColor } from "../../../utils/colorHelpers";
import {
  formatDateShort,
  formatEtaFromHours,
  formatPriorityLabel,
  isComplaintAssigned,
  normalizeStatus,
} from "../../../utils/complaintFormatters";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";

export default function HodComplaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("new-to-old");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkAssignModalVisible, setBulkAssignModalVisible] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [workerSearchQuery, setWorkerSearchQuery] = useState("");

  const matchesStatusFilter = (complaint, filterKey) => {
    if (filterKey === "all") return true;
    if (filterKey === "assigned") return isComplaintAssigned(complaint);
    if (filterKey === "unassigned") return !isComplaintAssigned(complaint);
    return normalizeStatus(complaint.status) === filterKey;
  };

  const statusChips = [
    { key: "all", label: t("common.all") },
    { key: "unassigned", label: t("hod.complaints.unassigned") },
    { key: "assigned", label: t("status.assigned") },
    { key: "pending", label: t("status.pending") },
    { key: "in-progress", label: t("hod.complaints.inProgress") },
  ];

  const baseFilteredComplaints = complaints.filter((complaint) => {
    const normalizedStatus = normalizeStatus(complaint.status);
    if (normalizedStatus === "resolved" || normalizedStatus === "cancelled") {
      return false;
    }

    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      complaint.ticketId?.toLowerCase().includes(query) ||
      complaint.title?.toLowerCase().includes(query) ||
      complaint.description?.toLowerCase().includes(query) ||
      complaint.locationName?.toLowerCase().includes(query);

    const matchesPriority =
      priorityFilter === "all"
        ? true
        : (complaint.priority || "").toLowerCase() === priorityFilter;

    const complaintDate = new Date(complaint.createdAt);
    const hasValidDate = !Number.isNaN(complaintDate.getTime());
    let matchesStartDate = true;
    let matchesEndDate = true;

    if (startDate && hasValidDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      matchesStartDate = complaintDate >= start;
    }

    if (endDate && hasValidDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesEndDate = complaintDate <= end;
    }

    return (
      matchesQuery && matchesPriority && matchesStartDate && matchesEndDate
    );
  });

  const statusCounts = statusChips.reduce((acc, chip) => {
    acc[chip.key] =
      chip.key === "all"
        ? baseFilteredComplaints.length
        : baseFilteredComplaints.filter((complaint) =>
            matchesStatusFilter(complaint, chip.key),
          ).length;
    return acc;
  }, {});

  const filteredComplaints = baseFilteredComplaints.filter((complaint) =>
    matchesStatusFilter(complaint, statusFilter),
  );
  const sortedComplaints = [...filteredComplaints].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    const safeA = Number.isNaN(dateA) ? 0 : dateA;
    const safeB = Number.isNaN(dateB) ? 0 : dateB;
    return sortOrder === "new-to-old" ? safeB - safeA : safeA - safeB;
  });

  const hasActiveFilters = () =>
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    sortOrder !== "new-to-old" ||
    Boolean(startDate) ||
    Boolean(endDate);

  const clearFilters = () => {
    setStatusFilter("all");
    setPriorityFilter("all");
    setSortOrder("new-to-old");
    setStartDate("");
    setEndDate("");
  };

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: HOD_OVERVIEW_URL,
      });

      const payload = res?.data;
      setComplaints(payload?.complaints || []);
      setStats(payload?.stats || null);
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

  const loadWorkers = async () => {
    try {
      const res = await apiCall({
        method: "GET",
        url: HOD_WORKERS_URL,
      });
      const payload = res?.data;
      setWorkers(payload?.workers || []);
    } catch (e) {
      console.error("Error loading workers:", e);
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2: t("hod.complaints.couldNotLoadWorkers"),
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
      .filter((c) => !isComplaintAssigned(c))
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
        text1: t("toast.error.title"),
        text2: t("hod.complaints.selectWorker"),
      });
      return;
    }

    try {
      setBulkAssigning(true);
      await Promise.all(
        selectedComplaints.map((complaintId) =>
          apiCall({
            method: "POST",
            url: HOD_ASSIGN_MULTIPLE_WORKERS_URL(complaintId),
            data: {
              workers: [{ workerId: selectedWorker }],
            },
          }),
        ),
      );

      Toast.show({
        type: "success",
        text1: t("toast.success.title"),
        text2: t("hod.complaints.assignedSuccessfully", {
          count: selectedComplaints.length,
        }),
      });

      setBulkAssignModalVisible(false);
      setSelectedComplaints([]);
      setSelectMode(false);
      setSelectedWorker("");
      load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2: e?.response?.data?.message || t("hod.complaints.couldNotAssign"),
      });
    } finally {
      setBulkAssigning(false);
    }
  };

  const onRefresh = () => {
    load(true);
  };

  const renderComplaintItem = ({ item }) => {
    const isSelected = selectedComplaints.includes(item.id);
    const isAssigned = isComplaintAssigned(item);
    const canSelect = selectMode && !isAssigned;
    const eta = formatEtaFromHours(
      item.estimatedCompletionTime,
      item.assignedAt,
      t("hod.complaints.overdue"),
    );

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
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <StatusPill status={item.status} />
                {item.sla && <SlaStatusBadge sla={item.sla} />}
              </View>
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
                {isAssigned ? (
                  <>
                    <CheckCircle
                      size={14}
                      color={colors.success || "#10B981"}
                    />
                    <Text
                      className="text-xs ml-1 font-semibold"
                      style={{ color: colors.success || "#10B981" }}
                    >
                      {t("status.assigned")}
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
                      {t("hod.complaints.unassigned")}
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
                    {formatPriorityLabel(t, item.priority)}
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
                        eta === t("hod.complaints.overdue")
                          ? "#EF4444"
                          : colors.info || "#3B82F6"
                      }
                    />
                    <Text
                      className="text-xs ml-1 font-semibold"
                      style={{
                        color:
                          eta === t("hod.complaints.overdue")
                            ? "#EF4444"
                            : colors.info || "#3B82F6",
                      }}
                    >
                      {t("worker.assigned.eta")}: {eta}
                    </Text>
                  </View>
                )}
              </View>

              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {formatDateShort(item.createdAt)}
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
        <BackButtonHeader
          title={t("hod.complaints.title")}
          hasBackButton={false}
        />

        {/* Search Bar */}
        <View className="px-4 pb-4 pt-4">
          <View
            className="flex-row items-center px-4 py-1 rounded-2xl"
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
              placeholder={t("hod.complaints.searchPlaceholder")}
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
            {t("hod.complaints.loadingComplaints")}
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
      <BackButtonHeader
        title={t("hod.complaints.title")}
        hasBackButton={false}
      />

      {/* Search Bar */}
      <View className="px-4 pb-4 pt-4">
        <View
          className="flex-row items-center px-4 py-1 rounded-2xl"
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
            placeholder={t("hod.complaints.searchPlaceholder")}
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
              {selectMode ? t("common.cancel") : t("hod.complaints.bulkSelect")}
            </Text>
          </TouchableOpacity>

          <View className="flex-row items-center">
            {selectMode && (
              <>
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
                    {t("hod.complaints.selectAll")}
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
                    {t("common.clear")}
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
                      {t("hod.complaints.assign")} ({selectedComplaints.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <PressableBlock onPress={() => setShowFilters((prev) => !prev)}>
              <View
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{
                  backgroundColor:
                    showFilters || hasActiveFilters()
                      ? colors.primary + "20"
                      : colors.backgroundSecondary,
                  borderWidth: 1.5,
                  borderColor:
                    showFilters || hasActiveFilters()
                      ? colors.primary
                      : colors.border,
                }}
              >
                <Filter
                  size={18}
                  color={
                    showFilters || hasActiveFilters()
                      ? colors.primary
                      : colors.textSecondary
                  }
                />
              </View>
            </PressableBlock>
          </View>
        </View>
      </View>

      <Modal
        visible={showFilters}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
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
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-base font-bold"
                style={{ color: colors.textPrimary }}
              >
                {t("common.filters")}
              </Text>
              <View className="flex-row items-center">
                {hasActiveFilters() && (
                  <PressableBlock onPress={clearFilters}>
                    <Text
                      className="text-sm font-semibold mr-3"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.complaints.clearAll")}
                    </Text>
                  </PressableBlock>
                )}
                <PressableBlock onPress={() => setShowFilters(false)}>
                  <X size={20} color={colors.textSecondary} />
                </PressableBlock>
              </View>
            </View>

            <View
              className="h-[1px] mb-3"
              style={{ backgroundColor: colors.border }}
            />

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                className="text-xs font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                {t("hod.complaints.filters.status")}
              </Text>
              <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
                {statusChips.map((chip) => (
                  <PressableBlock
                    key={chip.key}
                    onPress={() => setStatusFilter(chip.key)}
                  >
                    <View
                      className="px-3 py-2 rounded-xl border flex-row items-center"
                      style={{
                        borderColor:
                          statusFilter === chip.key
                            ? colors.primary
                            : colors.border,
                        backgroundColor:
                          statusFilter === chip.key
                            ? `${colors.primary}22`
                            : colors.backgroundPrimary,
                      }}
                    >
                      <Text
                        className="text-xs font-semibold mr-2"
                        style={{
                          color:
                            statusFilter === chip.key
                              ? colors.primary
                              : colors.textPrimary,
                        }}
                      >
                        {chip.label}
                      </Text>
                      <View
                        className="px-1.5 py-[1px] rounded-md"
                        style={{
                          backgroundColor:
                            statusFilter === chip.key
                              ? colors.primary + "30"
                              : colors.backgroundSecondary,
                        }}
                      >
                        <Text
                          className="text-[10px] font-bold"
                          style={{
                            color:
                              statusFilter === chip.key
                                ? colors.primary
                                : colors.textSecondary,
                          }}
                        >
                          {statusCounts[chip.key] || 0}
                        </Text>
                      </View>
                    </View>
                  </PressableBlock>
                ))}
              </View>

              <Text
                className="text-xs font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                {t("hod.complaints.filters.priority")}
              </Text>
              <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
                {["all", "high", "medium", "low"].map((priority) => (
                  <PressableBlock
                    key={priority}
                    onPress={() => setPriorityFilter(priority)}
                  >
                    <View
                      className="px-3 py-2 rounded-xl border"
                      style={{
                        borderColor:
                          priorityFilter === priority
                            ? colors.primary
                            : colors.border,
                        backgroundColor:
                          priorityFilter === priority
                            ? `${colors.primary}22`
                            : colors.backgroundPrimary,
                      }}
                    >
                      <Text
                        className="text-xs font-semibold capitalize"
                        style={{
                          color:
                            priorityFilter === priority
                              ? colors.primary
                              : colors.textPrimary,
                        }}
                      >
                        {priority === "all"
                          ? t("common.all")
                          : formatPriorityLabel(t, priority)}
                      </Text>
                    </View>
                  </PressableBlock>
                ))}
              </View>

              <Text
                className="text-xs font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                {t("common.sort")}
              </Text>
              <View className="flex-row mb-3" style={{ gap: 8 }}>
                <PressableBlock onPress={() => setSortOrder("new-to-old")}>
                  <View
                    className="px-3 py-2 rounded-xl border"
                    style={{
                      borderColor:
                        sortOrder === "new-to-old"
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        sortOrder === "new-to-old"
                          ? `${colors.primary}22`
                          : colors.backgroundPrimary,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{
                        color:
                          sortOrder === "new-to-old"
                            ? colors.primary
                            : colors.textPrimary,
                      }}
                    >
                      {t("worker.assigned.newToOld")}
                    </Text>
                  </View>
                </PressableBlock>
                <PressableBlock onPress={() => setSortOrder("old-to-new")}>
                  <View
                    className="px-3 py-2 rounded-xl border"
                    style={{
                      borderColor:
                        sortOrder === "old-to-new"
                          ? colors.primary
                          : colors.border,
                      backgroundColor:
                        sortOrder === "old-to-new"
                          ? `${colors.primary}22`
                          : colors.backgroundPrimary,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{
                        color:
                          sortOrder === "old-to-new"
                            ? colors.primary
                            : colors.textPrimary,
                      }}
                    >
                      {t("worker.assigned.oldToNew")}
                    </Text>
                  </View>
                </PressableBlock>
              </View>

              <Text
                className="text-xs font-semibold mb-2"
                style={{ color: colors.textSecondary }}
              >
                {t("hod.complaints.filters.dateRange")}
              </Text>
              <View className="flex-row pb-4" style={{ gap: 8 }}>
                <View className="flex-1">
                  <DateTimePickerModal
                    mode="date"
                    value={startDate}
                    onChange={setStartDate}
                    icon={Calendar}
                    placeholder={t("hod.complaints.filters.startDate")}
                    maxDateToday={true}
                  />
                </View>
                <View className="flex-1">
                  <DateTimePickerModal
                    mode="date"
                    value={endDate}
                    onChange={setEndDate}
                    icon={Calendar}
                    placeholder={t("hod.complaints.filters.endDate")}
                    maxDateToday={true}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <FlatList
        data={sortedComplaints}
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
              {searchQuery || hasActiveFilters()
                ? t("hod.complaints.noComplaintsFound")
                : t("hod.complaints.noDepartmentComplaints")}
            </Text>
            {(searchQuery || hasActiveFilters()) && (
              <Text
                className="text-sm mt-1 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("hod.complaints.tryChangingFilters")}
              </Text>
            )}
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
                {t("hod.complaints.bulkAssignTitle")}
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
                {t("hod.complaints.bulkSelectedCount", {
                  count: selectedComplaints.length,
                })}
              </Text>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {t("hod.complaints.bulkAssignHint")}
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
                  placeholder={t("hod.complaints.searchWorkers")}
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
                    {t("hod.complaints.noWorkers")}
                  </Text>
                </View>
              ) : (
                workers
                  .filter((w) =>
                    (w.fullName || w.username || "")
                      ?.toLowerCase()
                      .includes(workerSearchQuery.toLowerCase()),
                  )
                  .map((worker) => {
                    const workerId = String(worker.id || worker._id || "");
                    if (!workerId) return null;
                    return (
                      <TouchableOpacity
                        key={workerId}
                        onPress={() => setSelectedWorker(workerId)}
                        className="mb-2"
                      >
                        <View
                          className="p-4 rounded-xl flex-row items-center justify-between"
                          style={{
                            backgroundColor:
                              selectedWorker === workerId
                                ? colors.primary + "20"
                                : colors.backgroundSecondary,
                            borderWidth: 1.5,
                            borderColor:
                              selectedWorker === workerId
                                ? colors.primary
                                : colors.border,
                          }}
                        >
                          <View className="flex-1">
                            <Text
                              className="text-base font-semibold mb-1"
                              style={{
                                color:
                                  selectedWorker === workerId
                                    ? colors.primary
                                    : colors.textPrimary,
                              }}
                            >
                              {worker.fullName || worker.username}
                            </Text>
                            <Text
                              className="text-xs"
                              style={{ color: colors.textSecondary }}
                            >
                              {worker.specializations?.join(", ") ||
                                t("hod.complaints.generalWorker")}
                            </Text>
                          </View>

                          {selectedWorker === workerId && (
                            <CheckCircle size={24} color={colors.primary} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
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
                  {t("common.cancel")}
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
                    {t("hod.complaints.assignAll")}
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
