import { useRouter } from "expo-router";
import { ChevronDown, Inbox } from "lucide-react-native";
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
import FilterPanel from "../../../components/FilterPanel";
import PressableBlock from "../../../components/PressableBlock";
import SearchBar from "../../../components/SearchBar";
import apiCall from "../../../utils/api";
import { formatPriorityLabel } from "../../../utils/complaintFormatters";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { API_BASE } from "../../../url";

export default function ResolvedComplaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
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

  const LIMIT = 10;

  const buildQuery = (currentPage) => {
    const params = new URLSearchParams();
    params.set("scope", "all");
    params.set("status", "resolved");
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

      const res = await apiCall({
        method: "GET",
        url: `${API_BASE}/complaints?${buildQuery(currentPage)}`,
      });
      const payload = res.data;
      const fetched = payload.complaints;
      const pages = payload.pages;

      if (reset || pull) {
        setComplaints(fetched);
        setPage(1);
      } else {
        setComplaints((prev) => {
          const merged = [...prev, ...fetched];
          const seen = new Set();
          return merged.filter((item) => {
            const key = item?._id ?? item?.id;
            if (!key) return true;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        });
        setPage(currentPage);
      }

      setTotalCount(payload.total);
      setHasMore(currentPage < pages);
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
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    departmentFilter,
    priorityFilter,
    sortOrder,
    startDate,
    endDate,
    searchQuery,
  ]);

  const loadMore = () => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    const nextPage = page + 1;
    load(false, false, nextPage);
  };

  const hasActiveFilters =
    departmentFilter !== "all" ||
    priorityFilter !== "all" ||
    sortOrder !== "new-to-old" ||
    !!startDate ||
    !!endDate;

  const clearFilters = () => {
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
      <BackButtonHeader
        title={t("more.menu.resolvedComplaints.title")}
        hasBackButton={true}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
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
            statusOptions={[]}
            statusFilter="resolved"
            setStatusFilter={() => {}}
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
            <View className="items-center py-1">
              <Inbox size={18} color={colors.textSecondary} />
              <Text
                className="mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("hod.resolvedComplaints.noComplaintsDefault")}
              </Text>
            </View>
          </Card>
        ) : (
          complaints.map((complaint, index) => (
            <ComplaintCard
              key={`${complaint._id ?? complaint.id ?? index}`}
              complaint={complaint}
              onOpen={() =>
                router.push(
                  `/complaints/complaint-details?id=${complaint._id ?? complaint.id}`,
                )
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
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <ChevronDown size={14} color={colors.textSecondary} />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.textSecondary }}
                >
                  {t("complaints.loadMoreCount", {
                    current: complaints.length,
                    total: totalCount,
                  })}
                </Text>
              </View>
            )}
          </PressableBlock>
        )}
      </ScrollView>
    </View>
  );
}
