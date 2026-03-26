import { useRouter } from "expo-router";
import { User, CheckCircle, Clock, Star, ChevronDown } from "lucide-react-native";
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
import PressableBlock from "../../../components/PressableBlock";
import SearchBar from "../../../components/SearchBar";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import useDebouncedValue from "../../../utils/hooks/useDebouncedValue";
import { useHodWorkersList } from "../../../utils/hooks/useHodWorkersList";

export default function HodWorkersTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const {
    workers,
    isLoading: loading,
    isRefetching: refreshing,
    isFetchingNextPage: loadingMore,
    hasMore,
    loadMore,
    refresh,
    error,
  } = useHodWorkersList({ search: debouncedSearchQuery, limit: 20 });

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("toast.error.failed"),
      text2: t("hod.workers.couldNotLoadWorkers"),
    });
  }, [error, t]);

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader
          title={t("hod.workers.title")}
          hasBackButton={false}
        />

        {/* Search Bar */}
        <View className="px-4 py-4" pointerEvents="none">
          <SearchBar
            value={searchQuery}
            onChangeText={() => {}}
            placeholder={t("hod.workers.searchPlaceholder")}
          />
        </View>

        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            {t("hod.workers.loadingWorkers")}
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
      <BackButtonHeader title={t("hod.workers.title")} hasBackButton={false} />

      {/* Search Bar */}
      <View className="px-4 py-4">
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("hod.workers.searchPlaceholder")}
        />
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refresh()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {workers.length === 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                {searchQuery
                  ? t("hod.workers.noWorkers")
                  : t("hod.workers.noWorkers")}
              </Text>
            </View>
          </Card>
        ) : (
          workers.map((worker, index) => (
            <PressableBlock
              key={worker.id ?? String(index)}
              onPress={() => router.push(`/hod/worker-details?id=${worker.id}`)}
            >
              <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                {/* Worker Header */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.primary + "20" }}
                    >
                      <User size={24} color={colors.primary} />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text
                        className="text-base font-bold"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.fullName ??
                          worker.username ??
                          t("hod.workers.notAvailable")}
                      </Text>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: colors.textSecondary }}
                      >
                        {worker.email}
                      </Text>
                    </View>
                  </View>
                  <View
                    className="px-2.5 py-1 rounded-full ml-3"
                    style={{
                      backgroundColor:
                        worker.isActive === false
                          ? colors.danger + "18"
                          : colors.success + "18",
                    }}
                  >
                    <Text
                      className="text-[11px] font-semibold"
                      style={{
                        color:
                          worker.isActive === false
                            ? colors.danger
                            : colors.success,
                      }}
                    >
                      {worker.isActive === false
                        ? t("hod.workers.inactive")
                        : t("hod.workers.active")}
                    </Text>
                  </View>
                </View>

                {/* Worker Stats */}
                <View className="flex-row justify-between">
                  <View className="flex-1 items-center">
                    <View className="flex-row items-center mb-1">
                      <Clock size={14} color={colors.warning} />
                      <Text
                        className="text-lg font-bold ml-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.activeComplaints ?? 0}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.workers.active")}
                    </Text>
                  </View>

                  <View
                    className="w-[1px]"
                    style={{ backgroundColor: colors.border }}
                  />

                  <View className="flex-1 items-center">
                    <View className="flex-row items-center mb-1">
                      <CheckCircle size={14} color={colors.success} />
                      <Text
                        className="text-lg font-bold ml-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.completedCount ?? 0}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.workers.completed")}
                    </Text>
                  </View>

                  <View
                    className="w-[1px]"
                    style={{ backgroundColor: colors.border }}
                  />

                  <View className="flex-1 items-center">
                    <View className="flex-row items-center mb-1">
                      <Star size={14} color={colors.primary} />
                      <Text
                        className="text-lg font-bold ml-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.rating
                          ? worker.rating.toFixed(1)
                          : t("hod.workers.notAvailable")}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.workers.rating")}
                    </Text>
                  </View>
                </View>
              </Card>
            </PressableBlock>
          ))
        )}
        {hasMore && (
          <PressableBlock
            onPress={() => loadMore()}
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
