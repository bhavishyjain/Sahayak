import { useRouter } from "expo-router";
import { Inbox } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import ComplaintCard from "../../../components/ComplaintCard";
import FilterPanel from "../../../components/FilterPanel";
import SearchBar from "../../../components/SearchBar";
import { formatPriorityLabel } from "../../../data/complaintStatus";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import useComplaintList from "../../../utils/hooks/useComplaintList";
import useDebouncedValue from "../../../utils/hooks/useDebouncedValue";

export default function MyComplaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("new-to-old");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const LIMIT = 10;
  const {
    complaints,
    isLoading: loading,
    isFetching: refreshing,
    isFetchingNextPage: loadingMore,
    hasMore,
    loadMore,
    refresh,
    error,
  } = useComplaintList({
    scope: "mine",
    status: statusFilter,
    department: departmentFilter,
    priority: priorityFilter,
    sort: sortOrder,
    startDate,
    endDate,
    search: debouncedSearchQuery,
    limit: LIMIT,
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

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={t("complaints.myComplaints")}
        hasBackButton={true}
      />

      <FlatList
        data={complaints}
        keyExtractor={(item, index) => String(item?._id ?? item?.id ?? index)}
        renderItem={({ item }) => (
          <ComplaintCard
            complaint={item}
            onOpen={() =>
              router.push(
                `/complaints/complaint-details?id=${item._id ?? item.id}`,
              )
            }
          />
        )}
        ListHeaderComponent={
          <View style={{ padding: 16, paddingBottom: 0 }}>
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
                <View className="items-center py-1">
                  <Inbox size={18} color={colors.textSecondary} />
                  <Text
                    className="mt-2 text-center"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("complaints.noComplaints")}
                  </Text>
                </View>
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
            onRefresh={() => refresh()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (hasMore && !loadingMore && !loading && !refreshing) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
