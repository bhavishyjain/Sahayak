import { useLocalSearchParams } from "expo-router";
import { Award, Star, Trophy } from "lucide-react-native";
import { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useWorkerAnalytics } from "../../../utils/hooks/useWorkerAnalytics";

export default function WorkerTrophies() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const { workerId } = useLocalSearchParams();
  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );

  const {
    data,
    isLoading: loading,
    isRefetching: refreshing,
    refetch,
  } = useWorkerAnalytics(workerId);

  const trophies = data?.achievements?.trophyHistory ?? [];

  const getTrophyMeta = (trophyId) => {
    switch (trophyId) {
      case "community-hero":
        return { Icon: Trophy, tone: colors.success };
      case "century-club":
        return { Icon: Award, tone: colors.purple };
      case "quality-master":
        return { Icon: Star, tone: colors.warning };
      default:
        return { Icon: Trophy, tone: colors.primary };
    }
  };

  const getTrophyCopy = (trophy) => {
    const keyMap = {
      "speed-demon": "speedDemon",
      "quality-master": "qualityMaster",
      "community-hero": "communityHero",
      "century-club": "centuryClub",
      "consistent-performer": "consistentPerformer",
      "rising-star": "risingStar",
    };

    const badgeKey = keyMap[trophy?.id];
    if (!badgeKey) {
      return {
        name: trophy?.name ?? t("worker.leaderboard.badges.unknown.name"),
        description:
          trophy?.description ??
          t("worker.leaderboard.badges.unknown.description"),
      };
    }

    return {
      name: t(`worker.leaderboard.badges.${badgeKey}.name`),
      description: t(`worker.leaderboard.badges.${badgeKey}.description`),
    };
  };

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title={t("more.workerTrophiesScreen.title")} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("more.workerTrophiesScreen.title")} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refetch()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text
          className="text-sm leading-6 mb-4"
          style={{ color: colors.textSecondary }}
        >
          {t("more.workerTrophiesScreen.subtitle")}
        </Text>

        {trophies.length ? (
          <View style={{ gap: 12 }}>
            {trophies.map((trophy) => {
              const { Icon, tone } = getTrophyMeta(trophy.id);
              const copy = getTrophyCopy(trophy);
              const earnedDate = trophy.earnedAt
                ? new Date(trophy.earnedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : t("more.workerAnalyticsScreen.noValue");

              return (
                <View
                  key={`${trophy.id}-${trophy.earnedAt}`}
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-row items-center flex-1 pr-3">
                      <View
                        className="w-12 h-12 rounded-2xl items-center justify-center mr-3"
                        style={{ backgroundColor: tone + "18" }}
                      >
                        <Icon size={18} color={tone} />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-base font-bold"
                          style={{ color: colors.textPrimary }}
                        >
                          {copy.name}
                        </Text>
                        <Text
                          className="text-sm mt-1 leading-6"
                          style={{ color: colors.textSecondary }}
                        >
                          {copy.description}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: colors.textSecondary }}
                    >
                      {earnedDate}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View
            className="rounded-2xl p-5"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {t("more.workerTrophiesScreen.empty")}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
