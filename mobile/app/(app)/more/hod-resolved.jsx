import { useRouter } from "expo-router";
import { AlertCircle, Calendar, ChevronDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import ComplaintCard from "../../../components/ComplaintCard";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import SearchBar from "../../../components/SearchBar";
import { HOD_OVERVIEW_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import useDebouncedValue from "../../../utils/hooks/useDebouncedValue";

export default function HodResolvedComplaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
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
        url: HOD_OVERVIEW_URL,
        params: {
          page: requestedPage,
          limit: LIMIT,
          bucket: "resolved",
          search: debouncedSearchQuery.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      const resolvedOnly = res.data.complaints ?? [];
      setComplaints((prev) =>
        requestedPage === 1 ? resolvedOnly : [...prev, ...resolvedOnly],
      );
      setPage(requestedPage);
      setHasMore(requestedPage < Number(res.data?.pagination?.totalPages ?? 1));
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.resolvedComplaints.failed"),
        text2:
          e?.response?.data?.message ||
          t("hod.resolvedComplaints.loadingError"),
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

  const renderItem = ({ item }) => (
    <ComplaintCard
      complaint={item}
      onOpen={() =>
        router.push(`/complaints/complaint-details?id=${item._id ?? item.id}`)
      }
    />
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={t("hod.resolvedComplaints.title")}
        hasBackButton={true}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View className="px-4 pt-3 pb-2">
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("hod.resolvedComplaints.searchPlaceholder")}
            />
          </View>

          <View className="px-4 pb-2">
            <View className="flex-row" style={{ gap: 8 }}>
              <View className="flex-1">
                <DateTimePickerModal
                  mode="date"
                  value={startDate}
                  onChange={setStartDate}
                  icon={Calendar}
                  placeholder={t("hod.resolvedComplaints.startDate")}
                  maxDateToday={true}
                  containerStyle={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    marginBottom: 0,
                  }}
                />
              </View>
              <View className="flex-1">
                <DateTimePickerModal
                  mode="date"
                  value={endDate}
                  onChange={setEndDate}
                  icon={Calendar}
                  placeholder={t("hod.resolvedComplaints.endDate")}
                  maxDateToday={true}
                  containerStyle={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    marginBottom: 0,
                  }}
                />
              </View>
            </View>
          </View>

          <FlatList
            data={complaints}
            renderItem={renderItem}
            keyExtractor={(item) => item._id ?? item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 120,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-20">
                <AlertCircle size={40} color={colors.textSecondary} />
                <Text
                  className="text-sm mt-3 text-center"
                  style={{ color: colors.textSecondary }}
                >
                  {searchQuery || startDate || endDate
                    ? t("hod.resolvedComplaints.noComplaints")
                    : t("hod.resolvedComplaints.noComplaintsDefault")}
                </Text>
              </View>
            }
            ListFooterComponent={
              hasMore ? (
                <TouchableOpacity
                  onPress={() => load(false, page + 1)}
                  disabled={loadingMore}
                  className="mt-2 rounded-xl items-center justify-center py-3"
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
                </TouchableOpacity>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
}
