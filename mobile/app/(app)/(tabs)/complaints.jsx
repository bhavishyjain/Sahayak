import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
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
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import {
  ALL_STATUS_OPTIONS,
  formatPriorityLabel,
} from "../../../data/complaintStatus";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { API_BASE } from "../../../url";
import { useNetworkStatus } from "../../../utils/useNetworkStatus";
import {
  cacheComplaints,
  getCachedComplaints,
} from "../../../utils/complaintsCache";
import { getQueue, dequeue } from "../../../utils/offlineQueue";

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

  const baseUrl = API_BASE;
  const LIMIT = 10;

  const STATUS_OPTIONS = ALL_STATUS_OPTIONS.filter((s) => s !== "resolved");

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
    </View>
  );
}
