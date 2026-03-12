import { useRouter } from "expo-router";
import { Clock, MapPin } from "lucide-react-native";
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
import SearchBar from "../../../components/SearchBar";
import FilterPanel from "../../../components/FilterPanel";
import SlaStatusBadge from "../../../components/SlaStatusBadge";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import { getStatusColor, getPriorityColor } from "../../../utils/colorHelpers";
import {
  formatDateShort,
  formatEtaFromHours,
  formatPriorityLabel,
  formatStatusLabel,
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
      const data = payload?.complaints || [];
      setComplaints(data);
      setFilteredComplaints(data);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("worker.assigned.failed"),
        text2: e?.response?.data?.message || t("worker.assigned.loadingError"),
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
  };

  const hasActiveFilters =
    !!startDate ||
    !!endDate ||
    sortOrder !== "old-to-new" ||
    selectedPriority !== "all" ||
    selectedStatus !== "all";

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
          filteredComplaints.map((complaint) => {
            const eta = formatEtaFromHours(
              complaint.estimatedCompletionTime,
              complaint.assignedAt,
              t("worker.assigned.overdue"),
            );

            return (
              <PressableBlock
                key={complaint.id}
                onPress={() =>
                  router.push(
                    `/complaints/complaint-details?id=${complaint.id}`,
                  )
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
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
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
                          {formatStatusLabel(t, complaint.status)}
                        </Text>
                      </View>
                      {complaint.sla && <SlaStatusBadge sla={complaint.sla} />}
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
                      {complaint.locationName ||
                        t("worker.assigned.noLocation")}
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Clock size={14} color={colors.textSecondary} />
                      <Text
                        className="text-xs ml-1"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("worker.assigned.assignedAt", {
                          date: formatDateShort(complaint.assignedAt),
                        })}
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
                        {formatPriorityLabel(t, complaint.priority)}
                      </Text>
                    </View>
                  </View>
                  {eta && (
                    <View
                      className="mt-3 px-3 py-2 rounded-xl flex-row items-center justify-center"
                      style={{
                        backgroundColor:
                          eta === t("worker.assigned.overdue")
                            ? "#FEE2E2"
                            : colors.info
                              ? colors.info + "20"
                              : "#DBEAFE",
                      }}
                    >
                      <Clock
                        size={16}
                        color={
                          eta === t("worker.assigned.overdue")
                            ? "#EF4444"
                            : colors.info || "#3B82F6"
                        }
                      />
                      <Text
                        className="text-sm font-bold ml-2"
                        style={{
                          color:
                            eta === t("worker.assigned.overdue")
                              ? "#EF4444"
                              : colors.info || "#3B82F6",
                        }}
                      >
                        {t("worker.assigned.eta")}: {eta}
                      </Text>
                    </View>
                  )}
                </Card>
              </PressableBlock>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
