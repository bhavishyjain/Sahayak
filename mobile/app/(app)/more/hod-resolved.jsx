import { useRouter } from "expo-router";
import { AlertCircle, Calendar } from "lucide-react-native";
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
import ComplaintCard from "../../../components/ComplaintCard";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import SearchBar from "../../../components/SearchBar";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import useDebouncedValue from "../../../utils/hooks/useDebouncedValue";
import useRealtimeRefresh from "../../../utils/realtime/useRealtimeRefresh";
import { useHodResolvedList } from "../../../utils/hooks/useHodResolvedList";

export default function HodResolvedComplaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const {
    complaints,
    isLoading: loading,
    isRefetching: refreshing,
    isFetchingNextPage: loadingMore,
    refresh,
    loadMore,
    hasMore,
    error,
  } = useHodResolvedList({
    search: debouncedSearchQuery,
    startDate,
    endDate,
    limit: 20,
  });

  useRealtimeRefresh("complaint-updated", () => {
    refresh();
  });

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("hod.resolvedComplaints.failed"),
      text2:
        error?.response?.data?.message ||
        t("hod.resolvedComplaints.loadingError"),
    });
  }, [error, t]);

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
                onRefresh={() => refresh()}
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
              loadingMore ? (
                <View className="items-center py-4">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            onEndReached={() => {
              if (hasMore && !loadingMore && !loading && !refreshing) {
                loadMore();
              }
            }}
            onEndReachedThreshold={0.35}
          />
        </>
      )}
    </View>
  );
}
