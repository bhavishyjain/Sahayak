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

const EMPTY_SUMMARY = {
  stats: { total: 0, pending: 0, inProgress: 0, resolved: 0 },
  avgResolutionTime: null,
  mostActiveDepartment: null,
  departmentBreakdown: [],
  monthlyTrend: [],
  recent: [],
};

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
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
      setSummary(summaryPayload ?? EMPTY_SUMMARY);
      setSpots(heatmapPayload?.spots ?? []);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2:
          error?.response?.data?.message ?? t("toast.error.loadHomeFailed"),
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
      setNearbyComplaints(res?.data?.complaints ?? []);
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
      const { upvoteCount } = res?.data ?? {};
      setNearbyComplaints((prev) =>
        prev.map((c) =>
          c._id === complaintId
            ? { ...c, upvoteCount: upvoteCount ?? c.upvoteCount }
            : c,
        ),
      );
    } catch (_) {
      Toast.show({ type: "error", text1: t("home.nearby.upvoteFailed") });
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
        console.error(error);
      });
  }, []);

  const topHotspots = useMemo(() => (spots ?? []).slice(0, 6), [spots]);
  const reminders = useMemo(() => {
    const pending = Number(summary?.stats?.pending ?? 0);
    const recent = summary?.recent ?? [];
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

  const totalComplaintCount = Number(summary?.stats?.total ?? 0);
  const resolvedComplaintCount = Number(summary?.stats?.resolved ?? 0);
  const openComplaintCount = Math.max(
    totalComplaintCount - resolvedComplaintCount,
    0,
  );
  const hasStatsSection = [
    summary?.avgResolutionTime != null,
    summary?.mostActiveDepartment != null,
    (summary?.monthlyTrend ?? []).length > 0,
  ].some(Boolean);
  const showNearbySection = nearbyLoading ? true : nearbyComplaints.length > 0;

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
          onRefresh={() => loadData(true)}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row items-center mb-1">
          <Text
            className="text-sm font-medium"
            style={{ color: colors.textSecondary }}
          >
            {getGreeting()}
          </Text>
          <TrendingUp
            size={14}
            color={colors.textSecondary}
            style={{ marginLeft: 6 }}
          />
        </View>
        <Text
          className="text-3xl font-extrabold mb-3"
          style={{ color: colors.textPrimary }}
        >
          {user?.fullName ?? t("home.userFallback")}
        </Text>
        {openComplaintCount > 0 && (
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {t("home.youHave")}{" "}
            <Text style={{ color: colors.danger, fontWeight: "700" }}>
              {openComplaintCount} {t("home.openLabel")}
            </Text>{" "}
            {openComplaintCount === 1
              ? t("home.complaintSingular")
              : t("home.complaintPlural")}
          </Text>
        )}
      </View>

      {/* Overview */}
      {(() => {
        const totalCount = Number(summary?.stats?.total ?? 0);
        const pendingCount = Number(summary?.stats?.pending ?? 0);
        const resolvedCount = Number(summary?.stats?.resolved ?? 0);
        const resolvedPercent =
          totalCount > 0
            ? Math.min(100, Math.round((resolvedCount / totalCount) * 100))
            : 0;

        const overviewItems = [
          {
            key: "pending",
            value: pendingCount,
            Icon: AlertCircle,
            color: colors.danger,
          },
          {
            key: "assigned",
            value: Number(summary?.stats?.assigned ?? 0),
            Icon: Clock3,
            color: colors.info,
          },
          {
            key: "inProgress",
            value: Number(summary?.stats?.inProgress ?? 0),
            Icon: Timer,
            color: colors.warning,
          },
          {
            key: "resolved",
            value: Number(summary?.stats?.resolved ?? 0),
            Icon: CheckCircle2,
            color: colors.success,
          },
        ];

        return (
          <View
            className="rounded-3xl p-5 mb-5"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-lg font-extrabold"
                style={{ color: colors.textPrimary }}
              >
                {t("home.myComplaintsTitle")}
              </Text>
            </View>

            <View
              className="rounded-2xl p-4 mb-3"
              style={{
                backgroundColor: colors.cardBackground,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-end justify-between">
                <View>
                  <Text
                    className="text-xs font-semibold mb-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("home.stats.total")}
                  </Text>
                  <Text
                    className="text-3xl font-black"
                    style={{ color: colors.textPrimary }}
                  >
                    {totalCount}
                  </Text>
                </View>
                <View
                  className="px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${colors.success}1A` }}
                >
                  <Text
                    className="text-[11px] font-bold"
                    style={{ color: colors.success }}
                  >
                    {resolvedCount} {t("home.stats.resolved").toLowerCase()}
                  </Text>
                </View>
              </View>

              <View
                className="h-2 rounded-full mt-3 overflow-hidden"
                style={{ backgroundColor: colors.border }}
              >
                <View
                  className="h-2 rounded-full"
                  style={{
                    width: `${resolvedPercent}%`,
                    backgroundColor: colors.success,
                  }}
                />
              </View>
            </View>

            <View
              className="flex-row flex-wrap justify-between"
              style={{ gap: 8 }}
            >
              {overviewItems.map(({ key, value, Icon, color }) => (
                <View
                  key={key}
                  className="rounded-2xl p-3"
                  style={{
                    width: "48.5%",
                    backgroundColor: colors.cardBackground,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <View
                      className="w-8 h-8 rounded-xl items-center justify-center"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Icon size={15} color={color} />
                    </View>
                    <Text
                      className="text-xl font-extrabold"
                      style={{ color: colors.textPrimary }}
                    >
                      {value}
                    </Text>
                  </View>
                  <Text
                    className="text-[11px] font-semibold"
                    style={{ color: colors.textSecondary }}
                  >
                    {t(`home.stats.${key}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}

      {/* My Stats */}
      {hasStatsSection &&
        (() => {
          const trend = summary.monthlyTrend ?? [];
          const maxCount = Math.max(
            ...trend.map((m) => Number(m.count ?? 0)),
            1,
          );
          const MONTH_LABELS = [
            t("home.months.jan"),
            t("home.months.feb"),
            t("home.months.mar"),
            t("home.months.apr"),
            t("home.months.may"),
            t("home.months.jun"),
            t("home.months.jul"),
            t("home.months.aug"),
            t("home.months.sep"),
            t("home.months.oct"),
            t("home.months.nov"),
            t("home.months.dec"),
          ];
          const monthLabelW = 20;
          const monthBarAreaW = 108;
          const monthRowH = 8;
          const monthRowGap = 5;
          const monthChartH = trend.length
            ? trend.length * (monthRowH + monthRowGap) - monthRowGap + 2
            : 0;
          const monthChartW = 148;
          const departmentDataRaw = Array.isArray(summary?.departmentBreakdown)
            ? summary.departmentBreakdown
            : [];
          const departmentData = departmentDataRaw.length
            ? departmentDataRaw
                .filter((item) => item?.department)
                .slice(0, 4)
                .map((item) => ({
                  department: item.department,
                  count: Number(item.count ?? 0),
                }))
            : summary?.mostActiveDepartment
              ? [
                  {
                    department: summary.mostActiveDepartment,
                    count: Number(summary?.stats?.total ?? 0),
                  },
                ]
              : [];
          const departmentMax = Math.max(
            ...departmentData.map((item) => item.count),
            1,
          );
          const deptLabelW = 24;
          const deptBarAreaW = 72;
          const deptRowH = 8;
          const deptRowGap = 6;
          const deptChartH = departmentData.length
            ? departmentData.length * (deptRowH + deptRowGap) - deptRowGap + 2
            : 0;
          const deptChartW = 120;

          const avgLabel = (() => {
            const h = summary.avgResolutionTime;
            if (h == null) return t("home.notAvailable");
            if (h < 24) return `${h}${t("home.time.hourShort")}`;
            return `${Math.floor(h / 24)}${t("home.time.dayShort")} ${h % 24}${t("home.time.hourShort")}`;
          })();

          return (
            <View
              className="rounded-3xl p-5 mb-5"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View className="flex-row items-center mb-4">
                <View
                  className="w-9 h-9 rounded-xl items-center justify-center"
                  style={{ backgroundColor: `${colors.primary}15` }}
                >
                  <BarChart2 size={18} color={colors.primary} />
                </View>
                <Text
                  className="text-lg font-extrabold ml-2.5"
                  style={{ color: colors.textPrimary }}
                >
                  {t("home.myStatsTitle")}
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                {summary.avgResolutionTime != null && (
                  <View
                    className="rounded-2xl p-3.5 flex-row items-center"
                    style={{
                      backgroundColor: colors.cardBackground,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View
                      className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                      style={{
                        backgroundColor: `${colors.info}20`,
                      }}
                    >
                      <Timer size={16} color={colors.info} />
                    </View>
                    <View>
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("home.avgResolution")}
                      </Text>
                      <Text
                        className="text-base font-extrabold"
                        style={{ color: colors.textPrimary }}
                      >
                        {avgLabel}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {trend.length > 0 && (
                <View className="flex-row mt-3" style={{ gap: 10 }}>
                  <View
                    className="rounded-2xl p-3.5 flex-1"
                    style={{
                      backgroundColor: colors.cardBackground,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold mb-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("home.monthlyComplaints")}
                    </Text>

                    <Svg width={monthChartW} height={monthChartH + 10}>
                      {trend.map((m, i) => {
                        const monthCount = Number(m.count ?? 0);
                        const barW =
                          maxCount > 0
                            ? Math.max(
                                4,
                                (monthCount / maxCount) * monthBarAreaW,
                              )
                            : 4;
                        const y = i * (monthRowH + monthRowGap);
                        const monthLabel = String(
                          MONTH_LABELS[m.month - 1] ?? "",
                        ).slice(0, 3);

                        return (
                          <React.Fragment key={i}>
                            <SvgText
                              x={monthLabelW - 2}
                              y={y + monthRowH - 1}
                              fontSize={8}
                              textAnchor="end"
                              fill={colors.textSecondary}
                            >
                              {monthLabel}
                            </SvgText>
                            <Rect
                              x={monthLabelW}
                              y={y}
                              width={monthBarAreaW}
                              height={monthRowH}
                              rx={4}
                              fill={colors.border}
                              opacity={0.5}
                            />
                            <Rect
                              x={monthLabelW}
                              y={y}
                              width={barW}
                              height={monthRowH}
                              rx={4}
                              fill={colors.primary}
                            />
                            <SvgText
                              x={monthLabelW + monthBarAreaW + 4}
                              y={y + monthRowH - 1}
                              fontSize={8}
                              textAnchor="start"
                              fill={colors.textPrimary}
                            >
                              {monthCount}
                            </SvgText>
                          </React.Fragment>
                        );
                      })}
                    </Svg>
                  </View>

                  <View
                    className="rounded-2xl p-3"
                    style={{
                      width: 140,
                      backgroundColor: colors.cardBackground,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold mb-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("home.departmentComplaints")}
                    </Text>

                    {departmentData.length > 0 ? (
                      <Svg width={deptChartW} height={deptChartH + 10}>
                        {departmentData.map((item, index) => {
                          const count = Number(item.count ?? 0);
                          const barW =
                            departmentMax > 0
                              ? Math.max(
                                  4,
                                  (count / departmentMax) * deptBarAreaW,
                                )
                              : 4;
                          const y = index * (deptRowH + deptRowGap);
                          const shortLabel = String(
                            item.department ?? "",
                          ).slice(0, 3);

                          return (
                            <React.Fragment key={item.department}>
                              <SvgText
                                x={deptLabelW - 2}
                                y={y + deptRowH - 1}
                                fontSize={8}
                                textAnchor="end"
                                fill={colors.textSecondary}
                              >
                                {shortLabel}
                              </SvgText>
                              <Rect
                                x={deptLabelW}
                                y={y}
                                width={deptBarAreaW}
                                height={deptRowH}
                                rx={4}
                                fill={colors.border}
                                opacity={0.5}
                              />
                              <Rect
                                x={deptLabelW}
                                y={y}
                                width={barW}
                                height={deptRowH}
                                rx={4}
                                fill={colors.primary}
                              />
                              <SvgText
                                x={deptLabelW + deptBarAreaW + 4}
                                y={y + deptRowH - 1}
                                fontSize={8}
                                textAnchor="start"
                                fill={colors.textPrimary}
                              >
                                {count}
                              </SvgText>
                            </React.Fragment>
                          );
                        })}
                      </Svg>
                    ) : (
                      <Text
                        className="text-[11px]"
                        style={{ color: colors.textSecondary }}
                      >
                        {t("home.noDepartmentData")}
                      </Text>
                    )}
                  </View>
                </View>
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
      {showNearbySection && (
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
              {t("home.nearby.title")}
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
                        {t("home.nearby.distanceAway", {
                          distance: item.distance ?? 0,
                        })}
                      </Text>
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
                  <Pressable
                    onPress={() => handleNearbyUpvote(item._id)}
                    className="ml-3 items-center px-2 py-1"
                  >
                    <ThumbsUp size={16} color={colors.primary} />
                    <Text
                      className="text-xs font-bold mt-0.5"
                      style={{ color: colors.primary }}
                    >
                      {item.upvoteCount ?? 0}
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
              {t("home.seeMap")}
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
                {t("home.noHotspotData")}
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
                        {t("home.metricLabels.total")}
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
                        {t("home.metricLabels.open")}
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
                        {t("home.metricLabels.high")}
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
