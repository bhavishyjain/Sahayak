import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import ComplaintCard from "../../../components/ComplaintCard";
import SearchBar from "../../../components/SearchBar";
import FilterPanel from "../../../components/FilterPanel";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import useDebouncedValue from "../../../utils/hooks/useDebouncedValue";
import {
  formatPriorityLabel,
} from "../../../data/complaintStatus";
import { useWorkerAssignedList } from "../../../utils/hooks/useWorkerAssignedList";

export default function WorkerAssigned() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState("old-to-new");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const {
    complaints,
    isLoading: loading,
    isRefetching: refreshing,
    isFetchingNextPage: loadingMore,
    hasMore,
    loadMore,
    refresh,
    error,
  } = useWorkerAssignedList({
    search: debouncedSearchQuery,
    startDate,
    endDate,
    priority: selectedPriority,
    status: selectedStatus,
    limit: 20,
  });

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("worker.assigned.failed"),
      text2: error?.response?.data?.message ?? t("worker.assigned.loadingError"),
    });
  }, [error, t]);

  const sortedComplaints = useMemo(() => [...complaints].sort((a, b) => {
    const dateA = new Date(a.assignedAt ?? a.createdAt);
    const dateB = new Date(b.assignedAt ?? b.createdAt);
    return sortOrder === "new-to-old" ? dateB - dateA : dateA - dateB;
  }), [complaints, sortOrder]);

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSortOrder("old-to-new");
    setSelectedPriority("all");
    setSelectedStatus("all");
    setSearchQuery("");
  };

  const hasActiveFilters = [
    Boolean(startDate),
    Boolean(endDate),
    sortOrder !== "old-to-new",
    selectedPriority !== "all",
    selectedStatus !== "all",
    Boolean(searchQuery.trim()),
  ].some(Boolean);

  const handleScroll = (event) => {
    if (!hasMore || loadingMore || loading || refreshing) return;

    const {
      layoutMeasurement,
      contentOffset,
      contentSize,
    } = event.nativeEvent || {};

    const visibleHeight = Number(layoutMeasurement?.height || 0);
    const y = Number(contentOffset?.y || 0);
    const totalHeight = Number(contentSize?.height || 0);

    if (visibleHeight <= 0 || totalHeight <= 0) return;

    const distanceFromBottom = totalHeight - (visibleHeight + y);
    if (distanceFromBottom < 180) {
      loadMore();
    }
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
            {t("worker.assigned.loading")}
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
        title={t("worker.assigned.title")}
        hasBackButton={false}
      />

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refresh()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Search + Filter row */}
        <View className="mt-4 flex-row items-center" style={{ gap: 10 }}>
          <View className="flex-1">
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("worker.assigned.searchPlaceholder")}
            />
          </View>
          <FilterPanel
            variant="icon"
            statusFilter={selectedStatus}
            setStatusFilter={setSelectedStatus}
            priorityFilter={selectedPriority}
            setPriorityFilter={setSelectedPriority}
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

        {complaints.length === 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.assigned.noComplaints")}
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.assigned.allCaughtUp")}
              </Text>
            </View>
          </Card>
        ) : (
          sortedComplaints.map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              showAssignedAt
              onOpen={() =>
                router.push(`/complaints/complaint-details?id=${complaint.id}`)
              }
            />
          ))
        )}
        {loadingMore ? (
          <View className="items-center py-4">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
