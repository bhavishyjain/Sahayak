import { useRouter } from "expo-router";
import { CalendarDays, Inbox, ChevronDown } from "lucide-react-native";
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
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import SearchBar from "../../../components/SearchBar";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { WORKER_COMPLETED_URL } from "../../../url";
import useDebouncedValue from "../../../utils/hooks/useDebouncedValue";

export default function WorkerCompleted() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 20;

  const load = async (isRefresh = false, requestedPage = 1) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (requestedPage > 1) setLoadingMore(true);
      else if (complaints.length === 0) setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: WORKER_COMPLETED_URL,
        params: {
          page: requestedPage,
          limit: LIMIT,
          search: debouncedSearchQuery.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });

      const payload = res.data;
      const data = payload.complaints ?? [];
      setComplaints((prev) => (requestedPage === 1 ? data : [...prev, ...data]));
      setPage(requestedPage);
      setHasMore(requestedPage < Number(payload.pages ?? 1));
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("worker.completedWork.failed"),
        text2:
          e?.response?.data?.message || t("worker.completedWork.loadingError"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchQuery, startDate, endDate]);

  const hasActiveFilters = !!startDate || !!endDate || !!searchQuery.trim();

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
            {t("worker.completedWork.loading")}
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
        title={t("worker.completedWork.title")}
        hasBackButton={true}
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
        <View className="mt-4 mb-3">
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("worker.completedWork.search")}
          />
        </View>

        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={startDate}
              onChange={setStartDate}
              icon={CalendarDays}
              placeholder={t("worker.completedWork.startDate")}
              maxDateToday={true}
            />
          </View>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={endDate}
              onChange={setEndDate}
              icon={CalendarDays}
              placeholder={t("worker.completedWork.endDate")}
              maxDateToday={true}
            />
          </View>
        </View>

        {complaints.length > 0 && (
          <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
            {hasActiveFilters && (
              <View
                className="flex-row items-center px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: colors.warning + "20",
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: colors.warning }}
                >
                  {t("worker.completedWork.showing", {
                    filtered: complaints.length,
                    total: complaints.length,
                  })}
                </Text>
              </View>
            )}
          </View>
        )}

        {complaints.length === 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Inbox size={20} color={colors.textSecondary} />
              <Text
                className="text-base font-semibold mt-2"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.completedWork.noComplaints")}
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.completedWork.noComplaintsDesc")}
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
            onPress={() => load(false, page + 1)}
            disabled={loadingMore}
            className="mt-2 mb-4 rounded-xl items-center justify-center py-3"
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
                  {t("common.loadMore")}
                </Text>
              </View>
            )}
          </PressableBlock>
        )}
      </ScrollView>
    </View>
  );
}
