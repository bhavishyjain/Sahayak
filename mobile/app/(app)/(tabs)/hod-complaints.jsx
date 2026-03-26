import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle,
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
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import ComplaintCard from "../../../components/ComplaintCard";
import SearchBar from "../../../components/SearchBar";
import FilterPanel from "../../../components/FilterPanel";
import { HOD_ASSIGN_MULTIPLE_WORKERS_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { ALL_STATUS_OPTIONS, formatPriorityLabel } from "../../../data/complaintStatus";
import { invalidateComplaintQueries } from "../../../utils/invalidateComplaintQueries";
import { isComplaintAssigned } from "../../../utils/complaintHelpers";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import useDebouncedValue from "../../../utils/hooks/useDebouncedValue";
import useRealtimeRefresh from "../../../utils/realtime/useRealtimeRefresh";
import { useHodComplaintFeed } from "../../../utils/hooks/useHodComplaintFeed";
import { useHodWorkersList } from "../../../utils/hooks/useHodWorkersList";

export default function HodComplaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("new-to-old");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedComplaints, setSelectedComplaints] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [bulkAssignModalVisible, setBulkAssignModalVisible] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [workerSearchQuery, setWorkerSearchQuery] = useState("");
  const manageStatusOptions = ALL_STATUS_OPTIONS.filter(
    (status) => status !== "resolved",
  );
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const LIMIT = 20;

  useEffect(() => {
    if (statusFilter === "resolved") {
      setStatusFilter("all");
    }
  }, [statusFilter]);

  const {
    complaints,
    isLoading: loading,
    isRefetching: refreshing,
    isFetchingNextPage: loadingMore,
    hasMore,
    loadMore,
    refresh,
    error,
  } = useHodComplaintFeed({
    search: debouncedSearchQuery,
    priority: priorityFilter,
    sort: sortOrder,
    startDate,
    endDate,
    status: statusFilter,
    limit: LIMIT,
  });

  const {
    workers,
    isLoading: workersLoading,
    error: workersError,
    refresh: refreshWorkers,
  } = useHodWorkersList({ search: workerSearchQuery, limit: 50 });

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

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("toast.error.failed"),
      text2:
        error?.response?.data?.message || t("toast.error.loadComplaintsFailed"),
    });
  }, [error, t]);

  useEffect(() => {
    if (!workersError) return;
    Toast.show({
      type: "error",
      text1: t("toast.error.failed"),
      text2: t("hod.complaints.couldNotLoadWorkers"),
    });
  }, [workersError, t]);

  useRealtimeRefresh("complaint-updated", () => {
    refresh();
    refreshWorkers();
  });

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
    const selectableComplaintIds = complaints
      .filter((c) => !isComplaintAssigned(c))
      .map((c) => c.id);
    setSelectedComplaints(selectableComplaintIds);
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
      await Promise.all(
        selectedComplaints.map((complaintId) =>
          invalidateComplaintQueries(queryClient, { complaintId }),
        ),
      );
      await Promise.all([refresh(), refreshWorkers()]);
    } catch (_error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2: t("hod.complaints.couldNotAssign"),
      });
    } finally {
      setBulkAssigning(false);
    }
  };

  const onRefresh = () => Promise.all([refresh(), refreshWorkers()]);

  const handleLoadMore = () => {
    if (hasMore && !loadingMore && !loading && !refreshing) loadMore();
  };

  const renderComplaintItem = ({ item }) => {
    const isSelected = selectedComplaints.includes(item.id);
    const isAssigned = isComplaintAssigned(item);
    const canSelect = selectMode && !isAssigned;

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

        <View style={{ flex: 1 }}>
          <ComplaintCard
            complaint={item}
            showAssignmentStatus
            onOpen={() =>
              router.push(`/complaints/complaint-details?id=${item.id}`)
            }
          />
        </View>
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
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("hod.complaints.searchPlaceholder")}
          />
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
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("hod.complaints.searchPlaceholder")}
        />
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

          <View className="flex-row items-center" style={{ gap: 1 }}>
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

            <FilterPanel
              statusOptions={manageStatusOptions}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              startDate={startDate}
              endDate={endDate}
              setStartDate={setStartDate}
              setEndDate={setEndDate}
              hasActiveFilters={hasActiveFilters()}
              onClearFilters={clearFilters}
              t={t}
              formatPriorityLabel={formatPriorityLabel}
            />
          </View>
        </View>
      </View>

      <FlatList
        data={complaints}
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
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.35}
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
              <SearchBar
                value={workerSearchQuery}
                onChangeText={setWorkerSearchQuery}
                placeholder={t("hod.complaints.searchWorkers")}
              />
            </View>

            {/* Worker List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 400 }}
            >
              {workersLoading ? (
                <View className="py-8 items-center">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : workers.length === 0 ? (
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
                    String(w.fullName ?? w.username ?? "")
                      ?.toLowerCase()
                      .includes(workerSearchQuery.toLowerCase()),
                  )
                  .map((worker) => {
                    const workerId = String(worker.id ?? worker._id ?? "");
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
                              {worker.fullName ??
                                worker.username ??
                                t("hod.workers.notAvailable")}
                            </Text>
                            <Text
                              className="text-xs"
                              style={{ color: colors.textSecondary }}
                            >
                              {worker.specializations &&
                              worker.specializations.length > 0
                                ? worker.specializations.join(", ")
                                : t("hod.complaints.generalWorker")}
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
