import { useRouter } from "expo-router";
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
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Modal,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import { WORKER_LEADERBOARD_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";

export default function WorkerLeaderboard() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [period, setPeriod] = useState("monthly");
  const [department, setDepartment] = useState("all");
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);

  const periodOptions = [
    { value: "weekly", label: "This Week" },
    { value: "monthly", label: "This Month" },
    { value: "yearly", label: "This Year" },
  ];

  const departmentOptions = [
    { value: "all", label: "All Departments" },
    { value: "Road", label: "Road" },
    { value: "Water", label: "Water" },
    { value: "Electricity", label: "Electricity" },
    { value: "Waste", label: "Waste" },
    { value: "Drainage", label: "Drainage" },
    { value: "Other", label: "Other" },
  ];

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const departmentParam =
        department !== "all" ? `&department=${department}` : "";
      const res = await apiCall({
        method: "GET",
        url: `${WORKER_LEADERBOARD_URL}?period=${period}${departmentParam}`,
      });

      setLeaderboard(res?.data?.data?.leaderboard || []);
      setCurrentUser(res?.data?.data?.currentUser || null);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not load leaderboard",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, [period, department]);

  const getRankIcon = (rank) => {
    if (rank === 1) return { icon: Trophy, color: "#FFD700", size: 28 };
    if (rank === 2) return { icon: Medal, color: "#C0C0C0", size: 26 };
    if (rank === 3) return { icon: Medal, color: "#CD7F32", size: 24 };
    return { icon: Award, color: colors.textSecondary, size: 20 };
  };

  const BadgeItem = ({ badge }) => (
    <TouchableOpacity
      onPress={() => setSelectedBadge(badge)}
      className="flex-row items-center px-3 py-2 rounded-xl mr-2 mb-2"
      style={{
        backgroundColor: badge.color + "20",
        borderWidth: 1,
        borderColor: badge.color + "40",
      }}
      activeOpacity={0.7}
    >
      <Text className="text-lg mr-1.5">{badge.icon}</Text>
      <Text className="text-xs font-bold" style={{ color: badge.color }}>
        {badge.name}
      </Text>
    </TouchableOpacity>
  );

  const LeaderboardCard = ({ worker, index }) => {
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
                      You
                    </Text>
                  </View>
                )}
              </View>
              <Text
                className="text-xs mt-0.5 capitalize"
                style={{ color: colors.textSecondary }}
              >
                {worker.department} Department
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
              completed
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View
          className="flex-row items-center justify-between mb-3 pt-3"
          style={{ borderTopWidth: 1, borderTopColor: colors.border }}
        >
          <View className="flex-row items-center">
            <Star size={14} color="#EAB308" />
            <Text
              className="text-sm font-semibold ml-1"
              style={{ color: colors.textPrimary }}
            >
              {worker.rating.toFixed(1)}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Clock size={14} color={colors.info || "#3B82F6"} />
            <Text
              className="text-sm font-semibold ml-1"
              style={{ color: colors.textPrimary }}
            >
              {worker.averageCompletionTime > 0
                ? `${Math.round(worker.averageCompletionTime)}h`
                : "N/A"}
            </Text>
          </View>

          <View className="flex-row items-center">
            <Flame size={14} color="#EF4444" />
            <Text
              className="text-sm font-bold ml-1"
              style={{
                color:
                  worker.currentStreak > 0 ? "#EF4444" : colors.textSecondary,
              }}
            >
              {worker.currentStreak} day{worker.currentStreak !== 1 ? "s" : ""}
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
              <BadgeItem key={idx} badge={badge} />
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
        <BackButtonHeader title="Leaderboard" hasBackButton={false} />

        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            Loading leaderboard...
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
      <BackButtonHeader title="Leaderboard" hasBackButton={false} />

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
              Your Rank: #{currentUser.rank}
            </Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {currentUser.periodCompleted} completed this{" "}
                {period === "weekly"
                  ? "week"
                  : period === "monthly"
                    ? "month"
                    : "year"}
              </Text>
              {currentUser.currentStreak > 0 && (
                <View className="flex-row items-center">
                  <Flame size={16} color="#EF4444" />
                  <Text
                    className="text-sm font-bold ml-1"
                    style={{ color: "#EF4444" }}
                  >
                    {currentUser.currentStreak} day streak!
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Filters */}
      <View className="px-4 pt-2 pb-2">
        {/* Filter Buttons Row */}
        <View className="flex-row" style={{ gap: 8 }}>
          {/* Period Selector */}
          <View className="flex-1">
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
                  transform: [
                    { rotate: showPeriodDropdown ? "180deg" : "0deg" },
                  ],
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
                      borderBottomWidth:
                        index < periodOptions.length - 1 ? 1 : 0,
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

          {/* Department Selector */}
          <View className="flex-1">
            <TouchableOpacity
              onPress={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
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
                {departmentOptions.find((d) => d.value === department)?.label}
              </Text>
              <ChevronDown
                size={18}
                color={colors.textSecondary}
                style={{
                  transform: [
                    { rotate: showDepartmentDropdown ? "180deg" : "0deg" },
                  ],
                }}
              />
            </TouchableOpacity>

            {showDepartmentDropdown && (
              <View
                className="mt-2 rounded-2xl overflow-hidden absolute top-full left-0 right-0 z-10"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                }}
              >
                {departmentOptions.map((option, index) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      setDepartment(option.value);
                      setShowDepartmentDropdown(false);
                    }}
                    className="px-3 py-3"
                    style={{
                      backgroundColor:
                        department === option.value
                          ? colors.primary + "20"
                          : "transparent",
                      borderBottomWidth:
                        index < departmentOptions.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text
                      className="text-sm font-semibold"
                      style={{
                        color:
                          department === option.value
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
                  Top Performers
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
              <LeaderboardCard key={worker.id} worker={worker} index={index} />
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
                No data available
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                Complete some tasks to appear on the leaderboard!
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Info Modal - Metrics Explanation */}
      <Modal
        visible={showInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <View
          className="flex-1 justify-center items-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <View
            className="w-full rounded-3xl p-6"
            style={{
              backgroundColor: colors.backgroundPrimary,
              maxHeight: "80%",
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className="text-xl font-bold"
                style={{ color: colors.textPrimary }}
              >
                📊 How Metrics Work
              </Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Rating */}
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Star size={18} color="#EAB308" />
                  <Text
                    className="text-base font-bold ml-2"
                    style={{ color: colors.textPrimary }}
                  >
                    Rating
                  </Text>
                </View>
                <Text
                  className="text-sm leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  Average of all citizen feedback ratings (1-5 stars) on your
                  resolved complaints. Updated when citizens submit feedback
                  after resolution.
                </Text>
              </View>

              {/* Average Time */}
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Clock size={18} color={colors.info || "#3B82F6"} />
                  <Text
                    className="text-base font-bold ml-2"
                    style={{ color: colors.textPrimary }}
                  >
                    Average Time
                  </Text>
                </View>
                <Text
                  className="text-sm leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  Running average of hours taken from assignment to resolution.
                  Calculated as: (previous avg × completions + new time) ÷
                  (completions + 1). Updated on every HOD approval.
                </Text>
              </View>

              {/* Streak */}
              <View className="mb-4">
                <View className="flex-row items-center mb-2">
                  <Flame size={18} color="#EF4444" />
                  <Text
                    className="text-base font-bold ml-2"
                    style={{ color: colors.textPrimary }}
                  >
                    Streak
                  </Text>
                </View>
                <Text
                  className="text-sm leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  Consecutive days with at least 1 completion. Counts backwards
                  from today with a 1-day grace period. Resets if you miss 2+
                  days. Maintain 7+ days to earn the Consistent Performer badge!
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
                    Total Completed
                  </Text>
                </View>
                <Text
                  className="text-sm leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  Lifetime count of all resolved + closed complaints. This never
                  decreases - it's your career achievement counter. Incremented
                  on every HOD approval.
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
                  💡 Tip: All metrics are calculated in real-time when the
                  leaderboard loads!
                </Text>
              </View>
            </ScrollView>
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
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View
            className="rounded-t-3xl p-6"
            style={{
              backgroundColor: colors.backgroundPrimary,
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Text className="text-4xl mr-3">{selectedBadge?.icon}</Text>
                <View>
                  <Text
                    className="text-xl font-bold"
                    style={{
                      color: selectedBadge?.color || colors.textPrimary,
                    }}
                  >
                    {selectedBadge?.name}
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors.textSecondary }}
                  >
                    Achievement Badge
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
                style={{ color: "#fff" }}
              >
                Got it!
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
