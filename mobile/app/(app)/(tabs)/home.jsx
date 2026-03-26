import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  FilePlus2,
  Flame,
  ListChecks,
  Map,
  MapPin,
  RefreshCw,
  Building2,
  ThumbsUp,
  Star,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import NotificationBellButton from "../../../components/NotificationBellButton";
import PressableBlock from "../../../components/PressableBlock";
import {
  getPriorityBackgroundColor,
  getPriorityColor,
  getStatusColor,
} from "../../../data/complaintStatus";
import {
  getSeverityColor,
  getSeverityName,
} from "../../../utils/complaintHelpers";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";
import {
  useCitizenHomeSummary,
} from "../../../utils/hooks/useDashboardData";
import useComplaintList from "../../../utils/hooks/useComplaintList";
import { useNearbyComplaints } from "../../../utils/hooks/useNearbyComplaints";
import { invalidateComplaintQueries } from "../../../utils/invalidateComplaintQueries";

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greetings.morning");
    if (hour < 17) return t("greetings.afternoon");
    if (hour < 21) return t("greetings.evening");
    return t("greetings.night");
  };

  const {
    summary,
    heatmapSpots,
    isLoading: loading,
    isRefreshing: refreshing,
    error,
    refetch: loadData,
  } = useCitizenHomeSummary();
  const {
    complaints: nearbyComplaints,
    isLoading: nearbyLoading,
    isRefreshing: nearbyRefreshing,
    refetch: refetchNearby,
    upvoteComplaint,
  } = useNearbyComplaints();
  const {
    complaints: resolvedComplaints,
    isLoading: feedbackLoading,
    isFetching: feedbackRefreshing,
    refresh: refreshFeedbackComplaints,
  } = useComplaintList({
    scope: "mine",
    status: "resolved",
    sort: "new-to-old",
    limit: 20,
  });

  const feedbackPendingComplaints = useMemo(
    () =>
      resolvedComplaints
        .filter((item) => !item?.feedback?.rating)
        .slice(0, 5),
    [resolvedComplaints],
  );

  const handleNearbyUpvote = async (complaintId) => {
    try {
      await upvoteComplaint(complaintId);
      await invalidateComplaintQueries(queryClient, { complaintId });
    } catch (_) {
      Toast.show({ type: "error", text1: t("home.nearby.upvoteFailed") });
    }
  };

  useEffect(() => {
    getUserAuth()
      .then((userData) => {
        if (userData) {
          setUser(userData);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("toast.error.failed"),
      text2: error?.response?.data?.message ?? t("toast.error.loadHomeFailed"),
    });
  }, [error, t]);

  const topHotspots = useMemo(
    () => heatmapSpots.slice(0, 6),
    [heatmapSpots],
  );
  const lastUpdatedText = useMemo(() => {
    const recent = summary?.recent ?? [];
    const latest = recent[0];

    let text = t("home.noRecent");
    if (latest?.createdAt) {
      const diffMs = Date.now() - new Date(latest.createdAt).getTime();
      const diffHrs = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      text = t("home.lastUpdate", {
        hours: diffHrs,
        ticketId: latest.ticketId,
      });
    }

    return text;
  }, [summary, t]);

  const actions = [
    {
      key: "register",
      label: t("home.actions.newComplaint"),
      icon: FilePlus2,
      color: colors.primary,
      onPress: () => router.push("/(app)/more/new-complaint"),
    },
    {
      key: "heatmap",
      label: t("home.actions.heatMap"),
      icon: Map,
      color: colors.danger,
      onPress: () => router.push("/(tabs)/heatmap"),
    },
  ];

  const totalComplaintCount = Number(summary?.stats?.total ?? 0);
  const resolvedComplaintCount = Number(summary?.stats?.resolved ?? 0);
  const openComplaintCount = Math.max(
    totalComplaintCount - resolvedComplaintCount,
    0,
  );
  const openStatusColor = getStatusColor("pending", colors) ?? colors.danger;
  const highPriorityColor =
    getPriorityColor("High", colors) ?? colors.warning;

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 32,
        paddingBottom: 120,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            Promise.all([loadData(), refetchNearby(), refreshFeedbackComplaints()])
          }
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-6">
        <View className="flex-row items-center justify-between">
          <Text
            className="text-sm font-medium"
            style={{ color: colors.textSecondary }}
          >
            {getGreeting()}
          </Text>
          <NotificationBellButton />
        </View>
        <Text
          className="text-3xl font-extrabold"
          style={{ color: colors.textPrimary }}
        >
          {user?.fullName ?? t("home.userFallback")}
        </Text>
        {openComplaintCount > 0 && (
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {t("home.youHave")}{" "}
            <Text style={{ color: openStatusColor, fontWeight: "700" }}>
              {openComplaintCount} {t("home.openLabel")}
            </Text>{" "}
            {openComplaintCount === 1
              ? t("home.complaintSingular")
              : t("home.complaintPlural")}
          </Text>
        )}
      </View>

      <View
        className="rounded-2xl p-4 mb-5"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          className="text-base font-bold mb-1"
          style={{ color: colors.textPrimary }}
        >
          {t("home.snapshotTitle")}
        </Text>
        <Text className="text-xs mb-3" style={{ color: colors.textSecondary }}>
          {lastUpdatedText}
        </Text>

        <View className="flex-row" style={{ gap: 8 }}>
          {[
            {
              key: "total",
              label: t("home.summaryCards.total"),
              value: totalComplaintCount,
            },
            {
              key: "open",
              label: t("home.summaryCards.open"),
              value: openComplaintCount,
            },
            {
              key: "resolved",
              label: t("home.summaryCards.resolved"),
              value: resolvedComplaintCount,
            },
          ].map((item) => (
            <View
              key={item.key}
              className="flex-1 rounded-xl px-3 py-2.5"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.backgroundPrimary,
              }}
            >
              <Text
                className="text-[11px]"
                style={{ color: colors.textSecondary }}
              >
                {item.label}
              </Text>
              <Text
                className="text-xl font-bold mt-1"
                style={{ color: colors.textPrimary }}
              >
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Star
              size={20}
              color={colors.warning}
              style={{ marginRight: 8 }}
            />
            <Text
              className="text-xl font-extrabold"
              style={{ color: colors.textPrimary }}
            >
              {t("home.feedback.title")}
            </Text>
          </View>
          <Pressable
            onPress={() => refreshFeedbackComplaints()}
            disabled={feedbackRefreshing}
            className="flex-row items-center px-2.5 py-1 rounded-full"
            style={{ opacity: feedbackRefreshing ? 0.7 : 1 }}
          >
            <RefreshCw size={12} color={colors.primary} />
            <Text
              className="text-xs font-semibold ml-1"
              style={{ color: colors.primary }}
            >
              {t("home.feedback.reload")}
            </Text>
          </Pressable>
        </View>

        <View
          className="rounded-2xl px-4 py-2"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {feedbackLoading || feedbackRefreshing ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : feedbackPendingComplaints.length === 0 ? (
            <View className="py-6 items-center">
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {t("home.feedback.emptyTitle")}
              </Text>
              <Text
                className="text-sm mt-1 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("home.feedback.emptySubtitle")}
              </Text>
            </View>
          ) : (
            feedbackPendingComplaints.map((item, index) => (
              <View
                key={item.id || item._id}
                className="py-3"
                style={{
                  borderBottomWidth:
                    index < feedbackPendingComplaints.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Pressable
                  onPress={() =>
                    router.push(
                      `/complaints/complaint-details?id=${
                        item.id || item._id
                      }&openFeedback=1`,
                    )
                  }
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                      <View className="flex-row items-center mb-1">
                        <ListChecks
                          size={12}
                          color={colors.primary}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          className="text-xs font-bold"
                          style={{ color: colors.primary }}
                        >
                          {item.ticketId}
                        </Text>
                      </View>
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {item.title || t("home.nearby.complaintFallback")}
                      </Text>
                      <Text
                        className="text-xs mt-1"
                        style={{ color: colors.textSecondary }}
                        numberOfLines={1}
                      >
                        {item.department || t("home.nearby.departmentFallback")}
                      </Text>
                    </View>

                    <View
                      className="rounded-xl px-3 py-2"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: colors.dark }}
                      >
                        {t("home.feedback.action")}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            ))
          )}
        </View>
      </View>

      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <MapPin
              size={20}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text
              className="text-xl font-extrabold"
              style={{ color: colors.textPrimary }}
            >
              {t("home.nearby.title")}
            </Text>
          </View>
          <Pressable
            onPress={() => refetchNearby()}
            disabled={nearbyRefreshing}
            className="flex-row items-center px-2.5 py-1 rounded-full"
            style={{
              opacity: nearbyRefreshing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={12} color={colors.primary} />
            <Text
              className="text-xs font-semibold ml-1"
              style={{ color: colors.primary }}
            >
              {t("home.nearby.reload")}
            </Text>
          </Pressable>
        </View>
        <View
          className="rounded-2xl px-4 py-2"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {nearbyRefreshing || nearbyLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : nearbyComplaints.length === 0 ? (
            <View className="py-6 items-center">
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                {t("home.nearby.empty")}
              </Text>
            </View>
          ) : (
            nearbyComplaints.slice(0, 5).map((item, index) => {
              const priorityColor =
                getPriorityColor(item.priority, colors) ?? colors.textSecondary;
              const priorityBackgroundColor =
                getPriorityBackgroundColor(item.priority, colors, "20") ??
                `${colors.textSecondary}20`;

              return (
                <View
                  key={item._id}
                  className="flex-row py-3"
                  style={{
                    borderBottomWidth:
                      index < Math.min(nearbyComplaints.length, 5) - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                <Pressable
                  onPress={() =>
                    router.push(`/complaints/complaint-details?id=${item._id}`)
                  }
                  className="flex-1"
                  style={{ paddingRight: 8 }}
                >
                  <View className="flex-row items-center mb-1">
                    <View className="flex-row items-center mr-2">
                      <ListChecks
                        size={12}
                        color={colors.primary}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        className="text-xs font-bold"
                        style={{ color: colors.primary }}
                      >
                        {item.ticketId}
                      </Text>
                    </View>
                    <View
                      className="px-2 py-0.5 rounded-md mr-2"
                      style={{
                        backgroundColor: priorityBackgroundColor,
                      }}
                    >
                      <Text
                        className="text-[10px] font-bold"
                        style={{
                          color: priorityColor,
                        }}
                      >
                        {item.priority}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className="text-sm font-semibold mb-1"
                    style={{ color: colors.textPrimary }}
                    numberOfLines={1}
                  >
                    {item.refinedText ??
                      item.rawText ??
                        t("home.nearby.complaintFallback")}
                  </Text>
                  <View className="flex-row items-center">
                    <Building2
                      size={11}
                      color={colors.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      className="text-xs mr-3"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={1}
                    >
                      {item.department ?? t("home.nearby.departmentFallback")}
                    </Text>
                    <MapPin
                      size={11}
                      color={colors.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      className="text-xs flex-1"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={1}
                    >
                      {item.locationName ?? t("home.nearby.locationFallback")}
                    </Text>
                  </View>
                </Pressable>
                <View className="ml-3 self-stretch items-end justify-between gap-2">
                  <View className="items-end">
                    <Text
                      className="text-2xl font-extrabold leading-6"
                      style={{ color: colors.textPrimary }}
                    >
                      {`${item.distance ?? 0}`.replace(/\.0$/, "")}
                    </Text>
                    <Text
                      className="text-[10px] font-semibold"
                      style={{ color: colors.textSecondary }}
                    >
                        {t("home.nearby.distanceUnit")}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleNearbyUpvote(item._id)}
                    className="flex-row items-center py-1 pl-2"
                    hitSlop={8}
                  >
                    <ThumbsUp
                      size={12}
                      color={
                        item.hasUpvoted ? colors.primary : colors.textSecondary
                      }
                      fill={item.hasUpvoted ? colors.primary : "transparent"}
                    />
                    <Text
                      className="text-[11px] font-bold ml-1"
                      style={{
                        color: item.hasUpvoted
                          ? colors.primary
                          : colors.textSecondary,
                      }}
                    >
                      {item.upvoteCount ?? 0}
                    </Text>
                  </Pressable>
                </View>
                </View>
              );
            })
          )}
        </View>
      </View>

      <View className="flex-row mb-6">
        {actions.map((action, index) => (
          <PressableBlock
            key={action.key}
            onPress={action.onPress}
            className="flex-1 rounded-full py-3.5 flex-row items-center justify-center"
            style={{
              backgroundColor: action.color,
              marginRight: index === 0 ? 12 : 0,
            }}
          >
            <action.icon size={18} color={colors.dark} />
            <Text
              className="text-sm font-bold ml-2"
              style={{ color: colors.dark }}
            >
              {action.label}
            </Text>
          </PressableBlock>
        ))}
      </View>

      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Flame size={20} color={colors.danger} style={{ marginRight: 8 }} />
            <Text
              className="text-xl font-extrabold"
              style={{ color: colors.textPrimary }}
            >
              {t("home.hotspots")}
            </Text>
          </View>
          <PressableBlock
            onPress={() => router.push("/(tabs)/heatmap")}
            className="flex-row items-center"
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.primary }}
            >
              {t("home.seeMap")}
            </Text>
          </PressableBlock>
        </View>

        <View
          className="rounded-2xl p-4"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {topHotspots.length === 0 && !loading ? (
            <View className="py-6 items-center">
              <Map
                size={32}
                color={colors.textSecondary}
                style={{ opacity: 0.5 }}
              />
              <Text
                className="text-sm font-medium mt-2"
                style={{ color: colors.textSecondary }}
              >
                {t("home.noHotspotData")}
              </Text>
            </View>
          ) : (
            topHotspots.slice(0, 4).map((spot, idx) => {
              const severityColor =
                getSeverityColor(spot.severity, colors) ?? colors.textSecondary;
              const severityBgColor = severityColor
                ? `${severityColor}20`
                : `${colors.textSecondary}20`;

              return (
                <PressableBlock
                  key={`${spot.locationName}-${idx}`}
                  onPress={() => router.push("/(tabs)/heatmap")}
                >
                <View
                  className="flex-row items-center py-3"
                  style={{
                    borderBottomWidth:
                      idx < topHotspots.slice(0, 4).length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center mb-2">
                      <Text
                        className="text-sm font-bold flex-1"
                        style={{ color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {spot.locationName}
                      </Text>
                      <View
                        className="px-2 py-1 rounded-md ml-2"
                        style={{
                          backgroundColor: severityBgColor,
                        }}
                      >
                        <Text
                          className="text-[10px] font-bold"
                          style={{
                            color: severityColor,
                          }}
                        >
                          {getSeverityName(t, spot.severity)}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center">
                      <Text
                        className="text-xs mr-3"
                        style={{ color: colors.textSecondary }}
                      >
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontWeight: "700",
                          }}
                        >
                          {spot.totalComplaints}
                        </Text>{" "}
                        {t("home.metricLabels.total")}
                      </Text>
                      <Text
                        className="text-xs mr-3"
                        style={{ color: colors.textSecondary }}
                      >
                        <Text
                          style={{ color: openStatusColor, fontWeight: "700" }}
                        >
                          {spot.openComplaints}
                        </Text>{" "}
                        {t("home.metricLabels.open")}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        <Text
                          style={{
                            color: highPriorityColor,
                            fontWeight: "700",
                          }}
                        >
                          {spot.highPriorityComplaints}
                        </Text>{" "}
                        {t("home.metricLabels.high")}
                      </Text>
                    </View>
                  </View>
                </View>
                </PressableBlock>
              );
            })
          )}
        </View>
      </View>
    </ScrollView>
  );
}
