import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  View,
  ActivityIndicator,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import ComplaintCard from "../../../components/ComplaintCard";
import FilterPanel from "../../../components/FilterPanel";
import SearchBar from "../../../components/SearchBar";
import apiCall from "../../../utils/api";
import {
  ALL_STATUS_OPTIONS,
  formatPriorityLabel,
} from "../../../data/complaintStatus";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useNetworkStatus } from "../../../utils/useNetworkStatus";
import { dequeue, getQueue } from "../../../utils/offlineQueue";
import PressableBlock from "../../../components/PressableBlock";
import useDebouncedValue from "../../../utils/hooks/useDebouncedValue";
import { useCitizenComplaintFeed } from "../../../utils/hooks/useCitizenComplaintFeed";

export default function Complaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const { isOnline } = useNetworkStatus();

  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("new-to-old");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);

  const STATUS_OPTIONS = ALL_STATUS_OPTIONS.filter((s) => s !== "resolved");
  const {
    complaints,
    isLoading: loading,
    isRefetching: refreshing,
    isFetchingNextPage: loadingMore,
    loadMore,
    refresh,
    error,
  } = useCitizenComplaintFeed({
    status: statusFilter,
    department: departmentFilter,
    priority: priorityFilter,
    sort: sortOrder,
    startDate,
    endDate,
    search: debouncedSearchQuery,
    limit: 10,
    enabled: isOnline,
  });

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("toast.error.failed"),
      text2:
        error?.response?.data?.message || t("toast.error.loadComplaintsFailed"),
    });
  }, [error, t]);

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

  const syncQueuedComplaints = async () => {
    if (!isOnline) return;
    const queue = await getQueue();
    if (queue.length === 0) return;

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
          url: "/complaints",
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
        // keep it queued for the next online refresh
      }
    }
  };

  const handleRefresh = async () => {
    await syncQueuedComplaints();
    await refresh();
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("complaints.title")} hasBackButton={false} />

      <FlatList
        data={complaints}
        keyExtractor={(item, index) =>
          String(item?.id || item?._id || item?.ticketId || index)
        }
        renderItem={({ item }) => (
          <ComplaintCard
            complaint={item}
            onOpen={() =>
              router.push(`/complaints/complaint-details?id=${item.id || item._id}`)
            }
          />
        )}
        ListHeaderComponent={
          <View style={{ padding: 16, paddingBottom: 0 }}>
            <PressableBlock
              onPress={() => router.push("/(app)/more/new-complaint")}
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
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ paddingHorizontal: 16 }}>
              <Card style={{ margin: 0, marginTop: 10, flex: 0 }}>
                <Text style={{ color: colors.textSecondary }}>
                  {t("complaints.noComplaints")}
                </Text>
              </Card>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={{ height: 24 }} />
          )
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
