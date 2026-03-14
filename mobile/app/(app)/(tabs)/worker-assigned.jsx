import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
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
import apiCall from "../../../utils/api";
import {
  formatPriorityLabel,
  normalizePriority,
  normalizeStatus,
} from "../../../utils/complaintFormatters";
import { WORKER_ASSIGNED_URL } from "../../../url";

export default function WorkerAssigned() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState("old-to-new");
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

      const payload = res?.data;
      const data = payload?.complaints ?? [];
      setComplaints(data);
      setFilteredComplaints(data);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("worker.assigned.failed"),
        text2: e?.response?.data?.message ?? t("worker.assigned.loadingError"),
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
          [c.ticketId, c.title, c.description, c.location].some((value) =>
            value?.toLowerCase().includes(query),
          ),
      );
    }

    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(
        (c) => new Date(c.assignedAt ?? c.createdAt) >= start,
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (c) => new Date(c.assignedAt ?? c.createdAt) <= end,
      );
    }

    // Priority filter
    if (selectedPriority !== "all") {
      filtered = filtered.filter(
        (c) => normalizePriority(c.priority) === selectedPriority,
      );
    }

    // Status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter(
        (c) => normalizeStatus(c.status) === selectedStatus,
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.assignedAt ?? a.createdAt);
      const dateB = new Date(b.assignedAt ?? b.createdAt);
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
  };

  const hasActiveFilters = [
    Boolean(startDate),
    Boolean(endDate),
    sortOrder !== "old-to-new",
    selectedPriority !== "all",
    selectedStatus !== "all",
  ].some(Boolean);

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
        {/* Search + Filter row */}
        {complaints.length > 0 && (
          <View className="mt-4 mb-4 flex-row items-center" style={{ gap: 10 }}>
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
        )}

        {/* Active count chip */}
        {complaints.length > 0 && (
          <View className="mb-4 flex-row items-center" style={{ gap: 6 }}>
            {filteredComplaints.length !== complaints.length && (
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {t("worker.assigned.showingResults", {
                  count: filteredComplaints.length,
                  filtered: filteredComplaints.length,
                  total: complaints.length,
                })}
              </Text>
            )}
          </View>
        )}

        {filteredComplaints.length === 0 && complaints.length > 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.assigned.noResults")}
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.assigned.tryAdjusting")}
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
                {t("worker.assigned.noComplaints")}
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.dashboard.allCaughtUp")}
              </Text>
            </View>
          </Card>
        ) : (
          filteredComplaints.map((complaint) => (
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
      </ScrollView>
    </View>
  );
}
