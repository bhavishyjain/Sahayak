import {
  Trophy,
  Medal,
  Award,
  Flame,
  TrendingUp,
  Clock,
  Star,
  ChevronDown,
  Info,
  X,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import { WORKER_LEADERBOARD_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";

export default function WorkerLeaderboard() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [period, setPeriod] = useState("weekly");
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoPage, setInfoPage] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState(null);

  const ALL_BADGES = [
    {
      id: "speed-demon",
      name: t("worker.leaderboard.badges.speedDemon.name"),
      description: t("worker.leaderboard.badges.speedDemon.description"),
      Icon: Clock,
      color: colors.warning,
      requirement: t("worker.leaderboard.badges.speedDemon.requirement"),
    },
    {
      id: "quality-master",
      name: t("worker.leaderboard.badges.qualityMaster.name"),
      description: t("worker.leaderboard.badges.qualityMaster.description"),
      Icon: Star,
      color: colors.warning,
      requirement: t("worker.leaderboard.badges.qualityMaster.requirement"),
    },
    {
      id: "community-hero",
      name: t("worker.leaderboard.badges.communityHero.name"),
      description: t("worker.leaderboard.badges.communityHero.description"),
      Icon: Trophy,
      color: colors.success,
      requirement: t("worker.leaderboard.badges.communityHero.requirement"),
    },
    {
      id: "century-club",
      name: t("worker.leaderboard.badges.centuryClub.name"),
      description: t("worker.leaderboard.badges.centuryClub.description"),
      Icon: Award,
      color: colors.purple,
      requirement: t("worker.leaderboard.badges.centuryClub.requirement"),
    },
    {
      id: "consistent-performer",
      name: t("worker.leaderboard.badges.consistentPerformer.name"),
      description: t(
        "worker.leaderboard.badges.consistentPerformer.description",
      ),
      Icon: Flame,
      color: colors.danger,
      requirement: t(
        "worker.leaderboard.badges.consistentPerformer.requirement",
      ),
    },
    {
      id: "rising-star",
      name: t("worker.leaderboard.badges.risingStar.name"),
      description: t("worker.leaderboard.badges.risingStar.description"),
      Icon: TrendingUp,
      color: colors.info,
      requirement: t("worker.leaderboard.badges.risingStar.requirement"),
    },
  ];

  const pagerRef = useRef(null);
  const [modalWidth, setModalWidth] = useState(0);

  const periodOptions = [
    { value: "weekly", label: t("worker.leaderboard.periods.weekly") },
    { value: "monthly", label: t("worker.leaderboard.periods.monthly") },
    { value: "yearly", label: t("worker.leaderboard.periods.yearly") },
  ];
  const SelectedBadgeIcon = selectedBadge?.Icon ?? Award;

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: `${WORKER_LEADERBOARD_URL}?period=${period}`,
      });

      const payload = res?.data;
      setLeaderboard(payload?.leaderboard ?? []);
      setCurrentUser(payload?.currentUser ?? null);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("worker.leaderboard.failed"),
        text2:
          e?.response?.data?.message ?? t("worker.leaderboard.loadingError"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, [period]);

  const getRankIcon = (rank) => {
    if (rank === 1) return { icon: Trophy, color: "#FFD700", size: 28 };
    if (rank === 2) return { icon: Medal, color: "#C0C0C0", size: 26 };
    if (rank === 3) return { icon: Medal, color: "#CD7F32", size: 24 };
    return { icon: Award, color: colors.textSecondary, size: 20 };
  };

  const getBadgeData = (badge) => {
    const matchedBadge = ALL_BADGES.find((item) => item.id === badge?.id);
    if (matchedBadge) return matchedBadge;

    return {
      id: badge?.id ?? "unknown",
      name: badge?.name ?? t("worker.leaderboard.badges.unknown.name"),
      description:
        badge?.description ??
        t("worker.leaderboard.badges.unknown.description"),
      Icon: Award,
      color: colors.primary,
      requirement:
        badge?.requirement ??
        t("worker.leaderboard.badges.unknown.requirement"),
    };
  };

  const BadgeItem = ({ badge }) => {
    const BadgeIcon = badge.Icon ?? Award;
    const badgeColor = badge.color ?? colors.primary;

    return (
      <TouchableOpacity
        onPress={() => setSelectedBadge(badge)}
        className="flex-row items-center px-3 py-2 rounded-xl mr-2 mb-2"
        style={{
          backgroundColor: badgeColor + "20",
          borderWidth: 1,
          borderColor: badgeColor + "40",
        }}
        activeOpacity={0.7}
      >
        <BadgeIcon size={16} color={badgeColor} style={{ marginRight: 6 }} />
        <Text className="text-xs font-bold" style={{ color: badgeColor }}>
          {badge.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const LeaderboardCard = ({ worker }) => {
    const rankInfo = getRankIcon(worker.rank);
    const RankIcon = rankInfo.icon;
    const isTopThree = worker.rank <= 3;

    return (
      <Card
        style={{
          margin: 0,
          marginBottom: 12,
          flex: 0,
          borderWidth: worker.isCurrentUser ? 2 : 0,
          borderColor: worker.isCurrentUser ? colors.primary : "transparent",
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            {/* Rank Icon/Number */}
            <View className="items-center mr-3" style={{ width: 40 }}>
              {isTopThree ? (
                <RankIcon size={rankInfo.size} color={rankInfo.color} />
              ) : (
                <Text
                  className="text-2xl font-bold"
                  style={{ color: colors.textSecondary }}
                >
                  {worker.rank}
                </Text>
              )}
            </View>

            {/* Worker Info */}
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text
                  className="text-base font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {worker.fullName}
                </Text>
                {worker.isCurrentUser && (
                  <View
                    className="ml-2 px-2 py-0.5 rounded"
                    style={{ backgroundColor: colors.primary + "20" }}
                  >
                    <Text
                      className="text-xs font-bold"
                      style={{ color: colors.primary }}
                    >
                      {t("worker.leaderboard.you")}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                className="text-xs mt-0.5 capitalize"
                style={{ color: colors.textSecondary }}
              >
                {worker.department} {t("worker.leaderboard.departmentLabel")}
              </Text>
            </View>
          </View>

          {/* Score */}
          <View className="items-end">
            <Text
              className="text-2xl font-bold"
              style={{ color: colors.primary }}
            >
              {worker.periodCompleted}
            </Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {t("worker.leaderboard.completed")}
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View
          className="flex-row items-center justify-between mb-3 pt-3"
          style={{ borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <View className="flex-row items-center">
            <Star size={14} color={colors.warning} />
            <Text
              className="text-sm font-semibold ml-1"
              style={{ color: colors.textPrimary }}
            >
              {worker.rating.toFixed(1)}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Clock size={14} color={colors.info} />
            <Text
              className="text-sm font-semibold ml-1"
              style={{ color: colors.textPrimary }}
            >
              {worker.averageCompletionTime > 0
                ? `${Math.round(worker.averageCompletionTime)}${t("worker.leaderboard.hoursShort")}`
                : t("worker.leaderboard.notAvailable")}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Flame size={14} color={colors.danger} />
            <Text
              className="text-sm font-bold ml-1"
              style={{
                color:
                  worker.currentStreak > 0
                    ? colors.danger
                    : colors.textSecondary,
              }}
            >
              {t("worker.leaderboard.currentStreakShort", {
                count: worker.currentStreak,
                plural: worker.currentStreak !== 1 ? "s" : "",
              })}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Trophy size={14} color={colors.textSecondary} />
            <Text
              className="text-sm ml-1"
              style={{ color: colors.textSecondary }}
            >
              {worker.totalCompleted}
            </Text>
          </View>
        </View>

        {/* Badges */}
        {worker.badges && worker.badges.length > 0 && (
          <View className="flex-row flex-wrap">
            {worker.badges.map((badge, idx) => (
              <BadgeItem key={badge?.id ?? idx} badge={getBadgeData(badge)} />
            ))}
          </View>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader
          title={t("worker.leaderboard.title")}
          hasBackButton={false}
        />

        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            {t("worker.leaderboard.loading")}
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
        title={t("worker.leaderboard.title")}
        hasBackButton={false}
      />

      {/* Current User Highlight */}
      {currentUser && (
        <View className="px-4 pt-4 pb-2">
          <View
            className="px-4 py-3 rounded-2xl"
            style={{
              backgroundColor: colors.primary + "10",
              borderWidth: 2,
              borderColor: colors.primary,
            }}
          >
            <Text
              className="text-sm font-bold mb-2"
              style={{ color: colors.primary }}
            >
              {t("worker.leaderboard.yourRank")}: {currentUser.rank}
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {currentUser.periodCompleted}{" "}
                {t("worker.leaderboard.completedThis")}{" "}
                {period === "weekly"
                  ? t("worker.leaderboard.week")
                  : period === "monthly"
                    ? t("worker.leaderboard.month")
                    : t("worker.leaderboard.year")}
              </Text>
              {currentUser.currentStreak > 0 && (
                <View className="flex-row items-center">
                  <Flame size={16} color={colors.danger} />
                  <Text
                    className="text-sm font-bold ml-1"
                    style={{ color: colors.danger }}
                  >
                    {t("worker.leaderboard.currentStreak", {
                      count: currentUser.currentStreak,
                      plural: currentUser.currentStreak !== 1 ? "s" : "",
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Filters */}
      <View className="px-4 pt-2 pb-2">
        {/* Period Selector */}
        <View>
          <TouchableOpacity
            onPress={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="flex-row items-center justify-between px-3 py-3 rounded-2xl"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1.5,
              borderColor: colors.border,
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.textPrimary }}
              numberOfLines={1}
            >
              {periodOptions.find((p) => p.value === period)?.label}
            </Text>
            <ChevronDown
              size={18}
              color={colors.textSecondary}
              style={{
                transform: [{ rotate: showPeriodDropdown ? "180deg" : "0deg" }],
              }}
            />
          </TouchableOpacity>

          {showPeriodDropdown && (
            <View
              className="mt-2 rounded-2xl overflow-hidden absolute top-full left-0 right-0 z-10"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1.5,
                borderColor: colors.border,
              }}
            >
              {periodOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => {
                    setPeriod(option.value);
                    setShowPeriodDropdown(false);
                  }}
                  className="px-3 py-3"
                  style={{
                    backgroundColor:
                      period === option.value
                        ? colors.primary + "20"
                        : "transparent",
                    borderBottomWidth: index < periodOptions.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{
                      color:
                        period === option.value
                          ? colors.primary
                          : colors.textPrimary,
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

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
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Top Performers */}
        {leaderboard.length > 0 && (
          <View className="mb-2">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <TrendingUp size={20} color={colors.primary} />
                <Text
                  className="text-lg font-bold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("worker.leaderboard.topPerformers")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowInfoModal(true)}
                className="p-2 rounded-full"
                style={{ backgroundColor: colors.primary + "20" }}
              >
                <Info size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {leaderboard.map((worker, index) => (
              <LeaderboardCard key={worker.id} worker={worker} />
            ))}
          </View>
        )}

        {leaderboard.length === 0 && (
          <Card style={{ margin: 0, marginTop: 20 }}>
            <View className="items-center py-8">
              <Trophy size={48} color={colors.textSecondary} />
              <Text
                className="text-base font-semibold mt-3"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.leaderboard.noData")}
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.leaderboard.noDataDesc")}
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Info Modal - Metrics + All Badges (swipe left/right) */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowInfoModal(false);
          setInfoPage(0);
        }}
      >
        <View
          className="flex-1 justify-center items-center px-4"
          style={{ backgroundColor: `${colors.dark}99` }}
        >
          <View
            className="w-full rounded-3xl overflow-hidden"
            style={{
              backgroundColor: colors.backgroundPrimary,
              maxHeight: "85%",
            }}
            onLayout={(e) => setModalWidth(e.nativeEvent.layout.width)}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 pt-6 pb-3">
              <Text
                className="text-xl font-bold"
                style={{ color: colors.textPrimary }}
              >
                {infoPage === 0
                  ? t("worker.leaderboard.metricsInfo.title")
                  : t("worker.leaderboard.allAchievementBadges")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowInfoModal(false);
                  setInfoPage(0);
                }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Horizontal pager */}
            <ScrollView
              ref={pagerRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onMomentumScrollEnd={(e) => {
                if (modalWidth > 0) {
                  const page = Math.round(
                    e.nativeEvent.contentOffset.x / modalWidth,
                  );
                  setInfoPage(page);
                }
              }}
              style={{ maxHeight: 500 }}
            >
              {/* Page 0: Metrics */}
              {modalWidth > 0 && (
                <View style={{ width: modalWidth }}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    contentContainerStyle={{
                      paddingHorizontal: 24,
                      paddingBottom: 24,
                    }}
                  >
                    {/* Rating */}
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <Star size={18} color={colors.warning} />
                        <Text
                          className="text-base font-bold ml-2"
                          style={{ color: colors.textPrimary }}
                        >
                          {t("worker.leaderboard.rating")}
                        </Text>
                      </View>
                      <Text
                        className="text-sm leading-5"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("worker.leaderboard.metricsInfo.rating.desc")}
                      </Text>
                    </View>

                    {/* Average Time */}
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <Clock size={18} color={colors.info} />
                        <Text
                          className="text-base font-bold ml-2"
                          style={{ color: colors.textPrimary }}
                        >
                          {t("worker.leaderboard.avgTime")}
                        </Text>
                      </View>
                      <Text
                        className="text-sm leading-5"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("worker.leaderboard.metricsInfo.avgTime.desc")}
                      </Text>
                    </View>

                    {/* Streak */}
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <Flame size={18} color={colors.danger} />
                        <Text
                          className="text-base font-bold ml-2"
                          style={{ color: colors.textPrimary }}
                        >
                          {t("worker.leaderboard.streak")}
                        </Text>
                      </View>
                      <Text
                        className="text-sm leading-5"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("worker.leaderboard.metricsInfo.streak.desc")}
                      </Text>
                    </View>

                    {/* Total Completed */}
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <Trophy size={18} color={colors.textSecondary} />
                        <Text
                          className="text-base font-bold ml-2"
                          style={{ color: colors.textPrimary }}
                        >
                          {t(
                            "worker.leaderboard.metricsInfo.totalCompleted.title",
                          )}
                        </Text>
                      </View>
                      <Text
                        className="text-sm leading-5"
                        style={{ color: colors.textSecondary }}
                      >
                        {t(
                          "worker.leaderboard.metricsInfo.totalCompleted.desc",
                        )}
                      </Text>
                    </View>

                    <View
                      className="mt-2 p-3 rounded-xl"
                      style={{ backgroundColor: colors.primary + "10" }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: colors.primary }}
                      >
                        {t("worker.leaderboard.metricsInfo.tip")}
                      </Text>
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Page 1: All Badges */}
              {modalWidth > 0 && (
                <View style={{ width: modalWidth }}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                    contentContainerStyle={{
                      paddingHorizontal: 24,
                      paddingBottom: 24,
                    }}
                  >
                    {ALL_BADGES.map((badge) => {
                      const isEarned = currentUser?.badges?.some(
                        (b) => b.id === badge.id,
                      );
                      return (
                        <View
                          key={badge.id}
                          className="mb-3 p-4 rounded-2xl"
                          style={{
                            backgroundColor: isEarned
                              ? badge.color + "18"
                              : colors.backgroundSecondary,
                            borderWidth: 1.5,
                            borderColor: isEarned
                              ? badge.color + "60"
                              : colors.border,
                            opacity: 1,
                          }}
                        >
                          <View className="flex-row items-center mb-1.5">
                            <badge.Icon
                              size={22}
                              color={badge.color}
                              style={{ marginRight: 10 }}
                            />
                            <View className="flex-1">
                              <View className="flex-row items-center flex-wrap">
                                <Text
                                  className="text-base font-bold mr-2"
                                  style={{
                                    color: isEarned
                                      ? badge.color
                                      : colors.textPrimary,
                                  }}
                                >
                                  {badge.name}
                                </Text>
                                {isEarned && (
                                  <View
                                    className="px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: badge.color + "30",
                                    }}
                                  >
                                    <Text
                                      className="text-xs font-bold"
                                      style={{ color: badge.color }}
                                    >
                                      {t("worker.leaderboard.earned")}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                          <Text
                            className="text-sm mb-1"
                            style={{ color: colors.textSecondary }}
                          >
                            {badge.description}
                          </Text>
                          <Text
                            className="text-xs font-semibold"
                            style={{
                              color: isEarned
                                ? badge.color
                                : colors.textSecondary,
                            }}
                          >
                            {t("worker.leaderboard.requirementPrefix")}:{" "}
                            {badge.requirement}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </ScrollView>

            {/* Page indicator dots */}
            <View className="flex-row justify-center py-3" style={{ gap: 6 }}>
              {[0, 1].map((i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    setInfoPage(i);
                    pagerRef.current?.scrollTo({
                      x: i * modalWidth,
                      animated: true,
                    });
                  }}
                >
                  <View
                    style={{
                      width: infoPage === i ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor:
                        infoPage === i ? colors.primary : colors.border,
                    }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Badge Detail Modal */}
      <Modal
        visible={selectedBadge !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedBadge(null)}
      >
        <View
          className="flex-1 justify-end"
          style={{ backgroundColor: `${colors.dark}80` }}
        >
          <SafeAreaView
            edges={["bottom"]}
            style={{ backgroundColor: colors.backgroundPrimary }}
          >
            <View
              className="rounded-t-3xl p-6"
              style={{
                backgroundColor: colors.backgroundPrimary,
              }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  <SelectedBadgeIcon
                    size={34}
                    color={selectedBadge?.color ?? colors.primary}
                    style={{ marginRight: 12 }}
                  />
                  <View>
                    <Text
                      className="text-xl font-bold"
                      style={{
                        color: selectedBadge?.color ?? colors.textPrimary,
                      }}
                    >
                      {selectedBadge?.name}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("worker.leaderboard.achievementBadge")}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedBadge(null)}>
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View
                className="p-4 rounded-2xl mb-4"
                style={{
                  backgroundColor: selectedBadge?.color
                    ? selectedBadge.color + "20"
                    : colors.backgroundSecondary,
                  borderWidth: 2,
                  borderColor: selectedBadge?.color
                    ? selectedBadge.color + "40"
                    : colors.border,
                }}
              >
                <Text
                  className="text-base leading-6"
                  style={{ color: colors.textPrimary }}
                >
                  {selectedBadge?.description}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedBadge(null)}
                className="py-4 rounded-2xl"
                style={{ backgroundColor: colors.primary }}
              >
                <Text
                  className="text-center text-base font-bold"
                  style={{ color: colors.light }}
                >
                  {t("worker.leaderboard.gotIt")}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
