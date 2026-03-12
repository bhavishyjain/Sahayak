import React from "react";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Flame,
  ListChecks,
  Map,
  MapPin,
  TrendingUp,
  ChevronRight,
  BarChart2,
  Timer,
  Building2,
  ThumbsUp,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Dimensions,
} from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import {
  getPriorityColor,
  getSeverityColor,
} from "../../../utils/colorHelpers";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";
import * as Location from "expo-location";
import {
  GET_ANALYTICS_SUMMARY_URL,
  GET_HEATMAP_URL,
  GET_NEARBY_COMPLAINTS_URL,
  UPVOTE_COMPLAINT_URL,
} from "../../../url";

const { width } = Dimensions.get("window");

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    stats: { total: 0, pending: 0, inProgress: 0, resolved: 0 },
    avgResolutionTime: null,
    mostActiveDepartment: null,
    monthlyTrend: [],
    recent: [],
  });
  const [spots, setSpots] = useState([]);
  const [user, setUser] = useState(null);
  const [nearbyComplaints, setNearbyComplaints] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("greetings.morning");
    if (hour < 17) return t("greetings.afternoon");
    if (hour < 21) return t("greetings.evening");
    return t("greetings.night");
  };

  const loadData = async (pullToRefresh = false) => {
    try {
      if (pullToRefresh) setRefreshing(true);
      else setLoading(true);

      const [summaryRes, heatmapRes] = await Promise.all([
        apiCall({ method: "GET", url: GET_ANALYTICS_SUMMARY_URL }),
        apiCall({ method: "GET", url: GET_HEATMAP_URL }),
      ]);

      const summaryPayload = summaryRes?.data;
      const heatmapPayload = heatmapRes?.data;
      setSummary(summaryPayload || { stats: {}, recent: [] });
      setSpots(heatmapPayload?.spots || []);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2:
          error?.response?.data?.message || t("toast.error.loadHomeFailed"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadNearby = async () => {
    try {
      setNearbyLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const res = await apiCall({
        method: "GET",
        url: `${GET_NEARBY_COMPLAINTS_URL}?lat=${loc.coords.latitude}&lng=${loc.coords.longitude}&radius=5`,
      });
      setNearbyComplaints(res?.data?.complaints || []);
    } catch (_) {
      // fail silently — nearby is optional
    } finally {
      setNearbyLoading(false);
    }
  };

  const handleNearbyUpvote = async (complaintId) => {
    try {
      const res = await apiCall({
        method: "POST",
        url: UPVOTE_COMPLAINT_URL(complaintId),
      });
      const { upvoteCount } = res?.data || {};
      setNearbyComplaints((prev) =>
        prev.map((c) =>
          c._id === complaintId
            ? { ...c, upvoteCount: upvoteCount ?? c.upvoteCount }
            : c,
        ),
      );
    } catch (_) {
      Toast.show({ type: "error", text1: "Failed to upvote" });
    }
  };

  useEffect(() => {
    loadData(false);
    loadNearby();

    // Load user data
    getUserAuth()
      .then((userData) => {
        if (userData) {
          setUser(userData);
        }
      })
      .catch((error) => {
        console.error("Failed to load user:", error);
      });
  }, []);

  const topHotspots = useMemo(() => (spots || []).slice(0, 6), [spots]);
  const reminders = useMemo(() => {
    const pending = Number(summary?.stats?.pending || 0);
    const recent = summary?.recent || [];
    const latest = recent[0];

    let lastUpdatedText = t("home.noRecent");
    if (latest?.createdAt) {
      const diffMs = Date.now() - new Date(latest.createdAt).getTime();
      const diffHrs = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      lastUpdatedText = t("home.lastUpdate", {
        hours: diffHrs,
        ticketId: latest.ticketId,
      });
    }

    return {
      pendingText:
        pending > 0
          ? t("home.pendingText", {
              count: pending,
              plural: pending > 1 ? "s" : "",
            })
          : t("home.noPending"),
      lastUpdatedText,
    };
  }, [summary, t]);

  const actions = [
    {
      key: "register",
      label: t("home.actions.newComplaint"),
      icon: FilePlus2,
      color: colors.primary,
      onPress: () => router.push("/(app)/(tabs)/complaints"),
    },
    {
      key: "heatmap",
      label: t("home.actions.heatMap"),
      icon: Map,
      color: colors.danger,
      onPress: () => router.push("/(tabs)/heatmap"),
    },
  ];

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 70,
        paddingBottom: 120,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadData(true)}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-8">
        <Text
          className="text-sm font-medium mb-1"
          style={{ color: colors.textSecondary }}
        >
          {getGreeting()} 👋
        </Text>
        <Text
          className="text-3xl font-extrabold mb-3"
          style={{ color: colors.textPrimary }}
        >
          {user?.fullName || "User"}
        </Text>
        {summary?.stats?.pending > 0 && (
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {t("home.youHave") || "You have"}{" "}
            <Text style={{ color: colors.danger, fontWeight: "700" }}>
              {summary.stats.pending} {t("home.stats.pending").toLowerCase()}
            </Text>{" "}
            {summary.stats.pending === 1
              ? t("home.stats.complaints").toLowerCase().slice(0, -1)
              : t("home.stats.complaints").toLowerCase()}
          </Text>
        )}
      </View>

      {/* Unified Stats Card */}
      <View
        className="rounded-3xl p-5 mb-6"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text
            className="text-lg font-extrabold"
            style={{ color: colors.textPrimary }}
          >
            {t("home.overview")}
          </Text>
          <View className="flex-row items-center">
            <TrendingUp size={14} color={colors.success} />
            <Text
              className="text-xs font-semibold ml-1"
              style={{ color: colors.success }}
            >
              {t("home.active")}
            </Text>
          </View>
        </View>

        {/* Row 1: Total · Pending · Assigned */}
        <View className="flex-row justify-between mb-4">
          {[
            {
              key: "total",
              value: summary?.stats?.total ?? 0,
              Icon: ListChecks,
              color: colors.primary,
            },
            {
              key: "pending",
              value: summary?.stats?.pending ?? 0,
              Icon: AlertCircle,
              color: colors.danger,
            },
            {
              key: "assigned",
              value: summary?.stats?.assigned ?? 0,
              Icon: Clock3,
              color: colors.info || "#3B82F6",
            },
          ].map(({ key, value, Icon, color }) => (
            <View key={key} className="items-center" style={{ width: "30%" }}>
              <View
                className="w-11 h-11 rounded-2xl items-center justify-center mb-2"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon size={20} color={color} />
              </View>
              <Text
                className="text-2xl font-extrabold mb-1"
                style={{ color: colors.textPrimary }}
              >
                {value}
              </Text>
              <Text
                className="text-[11px] font-medium text-center"
                style={{ color: colors.textSecondary }}
              >
                {t(`home.stats.${key}`)}
              </Text>
            </View>
          ))}
        </View>

        {/* Row 2: In Progress · Resolved */}
        <View className="flex-row" style={{ gap: 10 }}>
          {[
            {
              key: "inProgress",
              value: summary?.stats?.inProgress ?? 0,
              Icon: Timer,
              color: colors.warning,
            },
            {
              key: "resolved",
              value: summary?.stats?.resolved ?? 0,
              Icon: CheckCircle2,
              color: colors.success,
            },
          ].map(({ key, value, Icon, color }) => (
            <View
              key={key}
              className="flex-1 flex-row items-center rounded-2xl p-3"
              style={{ backgroundColor: `${color}10` }}
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: `${color}20` }}
              >
                <Icon size={18} color={color} />
              </View>
              <View>
                <Text
                  className="text-2xl font-extrabold"
                  style={{ color: colors.textPrimary }}
                >
                  {value}
                </Text>
                <Text
                  className="text-[11px] font-medium"
                  style={{ color: colors.textSecondary }}
                >
                  {t(`home.stats.${key}`)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* My Stats — analytics card */}
      {(summary?.avgResolutionTime != null ||
        summary?.mostActiveDepartment ||
        (summary?.monthlyTrend || []).length > 0) &&
        (() => {
          const trend = summary.monthlyTrend || [];
          const maxCount = Math.max(...trend.map((m) => m.count), 1);
          const MONTH_LABELS = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          const barW = 18;
          const barGap = 6;
          const chartH = 48;
          const chartW = trend.length * (barW + barGap) - barGap;

          const avgLabel = (() => {
            const h = summary.avgResolutionTime;
            if (h == null) return "N/A";
            if (h < 24) return `${h}h`;
            return `${Math.floor(h / 24)}d ${h % 24}h`;
          })();

          return (
            <View
              className="rounded-3xl p-5 mb-6"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center mb-4">
                <BarChart2 size={18} color={colors.primary} />
                <Text
                  className="text-lg font-extrabold ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  My Stats
                </Text>
              </View>

              {/* Avg resolution + most active dept */}
              <View className="flex-row mb-4" style={{ gap: 8 }}>
                {summary.avgResolutionTime != null && (
                  <View
                    className="flex-1 rounded-2xl p-3"
                    style={{
                      backgroundColor: (colors.info || "#3B82F6") + "15",
                    }}
                  >
                    <Timer size={16} color={colors.info || "#3B82F6"} />
                    <Text
                      className="text-base font-extrabold mt-1"
                      style={{ color: colors.textPrimary }}
                    >
                      {avgLabel}
                    </Text>
                    <Text
                      className="text-[11px] mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      Avg resolution
                    </Text>
                  </View>
                )}
                {summary.mostActiveDepartment && (
                  <View
                    className="flex-1 rounded-2xl p-3"
                    style={{
                      backgroundColor: (colors.warning || "#F59E0B") + "15",
                    }}
                  >
                    <Building2 size={16} color={colors.warning || "#F59E0B"} />
                    <Text
                      className="text-base font-extrabold mt-1"
                      style={{ color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {summary.mostActiveDepartment}
                    </Text>
                    <Text
                      className="text-[11px] mt-0.5"
                      style={{ color: colors.textSecondary }}
                    >
                      Most active dept
                    </Text>
                  </View>
                )}
              </View>

              {/* Monthly sparkline */}
              {trend.length > 0 && (
                <>
                  <Text
                    className="text-xs font-semibold mb-2"
                    style={{ color: colors.textSecondary }}
                  >
                    Monthly complaints (last 6 months)
                  </Text>
                  <Svg width={chartW} height={chartH + 16}>
                    {trend.map((m, i) => {
                      const barH =
                        maxCount > 0
                          ? Math.max(3, (m.count / maxCount) * chartH)
                          : 3;
                      const x = i * (barW + barGap);
                      const y = chartH - barH;
                      return (
                        <React.Fragment key={i}>
                          <Rect
                            x={x}
                            y={y}
                            width={barW}
                            height={barH}
                            rx={4}
                            fill={m.count > 0 ? colors.primary : colors.border}
                            opacity={m.count > 0 ? 1 : 0.4}
                          />
                          <SvgText
                            x={x + barW / 2}
                            y={chartH + 13}
                            fontSize={9}
                            textAnchor="middle"
                            fill={colors.textSecondary}
                          >
                            {MONTH_LABELS[m.month - 1]}
                          </SvgText>
                        </React.Fragment>
                      );
                    })}
                  </Svg>
                </>
              )}
            </View>
          );
        })()}

      {/* Quick Actions - Horizontal Pills */}
      <View className="flex-row mb-6">
        {actions.map((action) => (
          <PressableBlock
            key={action.key}
            onPress={action.onPress}
            className="flex-1 mr-3 rounded-full py-3.5 flex-row items-center justify-center"
            style={{
              backgroundColor: action.color,
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

      {/* Nearby Complaints Section */}
      {(nearbyLoading || nearbyComplaints.length > 0) && (
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <MapPin
              size={20}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text
              className="text-xl font-extrabold"
              style={{ color: colors.textPrimary }}
            >
              Nearby Open Issues
            </Text>
          </View>
          <View
            className="rounded-2xl px-4 py-2"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {nearbyLoading ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              nearbyComplaints.slice(0, 5).map((item, index) => (
                <View
                  key={item._id}
                  className="flex-row items-center py-3"
                  style={{
                    borderBottomWidth:
                      index < Math.min(nearbyComplaints.length, 5) - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/complaints/complaint-details?id=${item._id}`,
                      )
                    }
                    className="flex-1"
                  >
                    <View className="flex-row items-center mb-1">
                      <Text
                        className="text-xs font-bold mr-2"
                        style={{ color: colors.primary }}
                      >
                        #{item.ticketId}
                      </Text>
                      <View
                        className="px-2 py-0.5 rounded-md mr-2"
                        style={{
                          backgroundColor: `${getPriorityColor(item.priority, colors)}20`,
                        }}
                      >
                        <Text
                          className="text-[10px] font-bold"
                          style={{
                            color: getPriorityColor(item.priority, colors),
                          }}
                        >
                          {item.priority}
                        </Text>
                      </View>
                      <Text
                        className="text-[10px]"
                        style={{ color: colors.textSecondary }}
                      >
                        {item.distance} km away
                      </Text>
                    </View>
                    <Text
                      className="text-sm font-semibold mb-1"
                      style={{ color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {item.refinedText || item.rawText || "Complaint"}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {item.department} • {item.locationName || "Nearby"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleNearbyUpvote(item._id)}
                    className="ml-3 items-center px-2 py-1"
                  >
                    <ThumbsUp size={16} color={colors.primary} />
                    <Text
                      className="text-xs font-bold mt-0.5"
                      style={{ color: colors.primary }}
                    >
                      {item.upvoteCount || 0}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {/* Hotspots Section */}
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Flame size={20} color={colors.danger} style={{ marginRight: 8 }} />
            <Text
              className="text-xl font-extrabold"
              style={{ color: colors.textPrimary }}
            >
              Hotspots
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
              See Map
            </Text>
            <ChevronRight
              size={16}
              color={colors.primary}
              style={{ marginLeft: 4 }}
            />
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
                No hotspot data
              </Text>
            </View>
          ) : (
            topHotspots.slice(0, 4).map((spot, idx) => (
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
                          backgroundColor: `${getSeverityColor(spot.severity, colors)}20`,
                        }}
                      >
                        <Text
                          className="text-[10px] font-bold capitalize"
                          style={{
                            color: getSeverityColor(spot.severity, colors),
                          }}
                        >
                          {spot.severity}
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
                        total
                      </Text>
                      <Text
                        className="text-xs mr-3"
                        style={{ color: colors.textSecondary }}
                      >
                        <Text
                          style={{ color: colors.danger, fontWeight: "700" }}
                        >
                          {spot.openComplaints}
                        </Text>{" "}
                        open
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors.textSecondary }}
                      >
                        <Text
                          style={{ color: colors.warning, fontWeight: "700" }}
                        >
                          {spot.highPriorityComplaints}
                        </Text>{" "}
                        high
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </View>
              </PressableBlock>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}
