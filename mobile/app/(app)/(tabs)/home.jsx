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
  MessageCircle,
  Search,
  TrendingUp,
  Bell,
  ChevronRight,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  Dimensions,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import {
  getStatusColor,
  getSeverityColor,
  getPriorityColor,
} from "../../../utils/colorHelpers";
import { useTheme } from "../../../utils/context/theme";
import getUserAuth from "../../../utils/userAuth";
import { API_BASE } from "../../../url";

const { width } = Dimensions.get("window");

export default function Home() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    stats: { total: 0, pending: 0, inProgress: 0, resolved: 0 },
    recent: [],
  });
  const [spots, setSpots] = useState([]);
  const [user, setUser] = useState(null);

  const baseUrl = API_BASE;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    if (hour < 21) return "Good Evening";
    return "Good Night";
  };

  const loadData = async (pullToRefresh = false) => {
    try {
      if (pullToRefresh) setRefreshing(true);
      else setLoading(true);

      const [summaryRes, heatmapRes] = await Promise.all([
        apiCall({ method: "GET", url: `${baseUrl}/dashboard/summary` }),
        apiCall({ method: "GET", url: `${baseUrl}/dashboard/heatmap` }),
      ]);

      const summaryPayload = summaryRes?.data;
      const heatmapPayload = heatmapRes?.data;
      setSummary(summaryPayload || { stats: {}, recent: [] });
      setSpots(heatmapPayload?.spots || []);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: error?.response?.data?.message || "Could not load home data.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);

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

  const myComplaints = useMemo(() => summary?.recent || [], [summary?.recent]);

  const topHotspots = useMemo(() => (spots || []).slice(0, 6), [spots]);
  const reminders = useMemo(() => {
    const pending = Number(summary?.stats?.pending || 0);
    const recent = summary?.recent || [];
    const latest = recent[0];

    let lastUpdatedText = "No recent complaint updates yet.";
    if (latest?.createdAt) {
      const diffMs = Date.now() - new Date(latest.createdAt).getTime();
      const diffHrs = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
      lastUpdatedText = `Last complaint was filed ${diffHrs}h ago (${latest.ticketId}).`;
    }

    return {
      pendingText:
        pending > 0
          ? `You have ${pending} pending complaint${pending > 1 ? "s" : ""}.`
          : "No pending complaints right now.",
      lastUpdatedText,
    };
  }, [summary]);

  const actions = [
    {
      key: "register",
      label: "New Complaint",
      icon: FilePlus2,
      color: colors.primary,
      onPress: () => router.push("/(tabs)/complaints"),
    },
    {
      key: "heatmap",
      label: "Heat Map",
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
            You have{" "}
            <Text style={{ color: colors.danger, fontWeight: "700" }}>
              {summary.stats.pending} pending
            </Text>{" "}
            {summary.stats.pending === 1 ? "complaint" : "complaints"}
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
            Overview
          </Text>
          <View className="flex-row items-center">
            <TrendingUp size={14} color={colors.success} />
            <Text
              className="text-xs font-semibold ml-1"
              style={{ color: colors.success }}
            >
              Active
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between">
          <View className="items-center" style={{ width: "22%" }}>
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center mb-2"
              style={{ backgroundColor: `${colors.primary}15` }}
            >
              <ListChecks size={22} color={colors.primary} />
            </View>
            <Text
              className="text-2xl font-extrabold mb-1"
              style={{ color: colors.textPrimary }}
            >
              {summary?.stats?.total ?? 0}
            </Text>
            <Text
              className="text-[11px] font-medium text-center"
              style={{ color: colors.textSecondary }}
            >
              Total
            </Text>
          </View>

          <View className="items-center" style={{ width: "22%" }}>
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center mb-2"
              style={{ backgroundColor: `${colors.danger}15` }}
            >
              <AlertCircle size={22} color={colors.danger} />
            </View>
            <Text
              className="text-2xl font-extrabold mb-1"
              style={{ color: colors.textPrimary }}
            >
              {summary?.stats?.pending ?? 0}
            </Text>
            <Text
              className="text-[11px] font-medium text-center"
              style={{ color: colors.textSecondary }}
            >
              Pending
            </Text>
          </View>

          <View className="items-center" style={{ width: "22%" }}>
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center mb-2"
              style={{ backgroundColor: `${colors.warning}15` }}
            >
              <Clock3 size={22} color={colors.warning} />
            </View>
            <Text
              className="text-2xl font-extrabold mb-1"
              style={{ color: colors.textPrimary }}
            >
              {summary?.stats?.inProgress ?? 0}
            </Text>
            <Text
              className="text-[11px] font-medium text-center"
              style={{ color: colors.textSecondary }}
            >
              Active
            </Text>
          </View>

          <View className="items-center" style={{ width: "22%" }}>
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center mb-2"
              style={{ backgroundColor: `${colors.success}15` }}
            >
              <CheckCircle2 size={22} color={colors.success} />
            </View>
            <Text
              className="text-2xl font-extrabold mb-1"
              style={{ color: colors.textPrimary }}
            >
              {summary?.stats?.resolved ?? 0}
            </Text>
            <Text
              className="text-[11px] font-medium text-center"
              style={{ color: colors.textSecondary }}
            >
              Done
            </Text>
          </View>
        </View>
      </View>

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

      {/* My Complaints Section */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text
            className="text-xl font-extrabold"
            style={{ color: colors.textPrimary }}
          >
            Recent Complaints
          </Text>
          <PressableBlock
            onPress={() => router.push("/(tabs)/complaints")}
            className="flex-row items-center"
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.primary }}
            >
              View All
            </Text>
            <ChevronRight
              size={16}
              color={colors.primary}
              style={{ marginLeft: 4 }}
            />
          </PressableBlock>
        </View>

        <View
          className="rounded-2xl px-4 py-2"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {(myComplaints || []).length === 0 && !loading ? (
            <View className="py-6 items-center">
              <ListChecks
                size={32}
                color={colors.textSecondary}
                style={{ opacity: 0.5 }}
              />
              <Text
                className="text-sm font-medium mt-2"
                style={{ color: colors.textSecondary }}
              >
                No complaints yet
              </Text>
            </View>
          ) : (
            (myComplaints || []).slice(0, 3).map((item, index) => (
              <PressableBlock
                key={item.id || item.ticketId}
                onPress={() =>
                  router.push(`/complaints/complaint-details?id=${item.id}`)
                }
              >
                <View
                  className="flex-row items-center py-3"
                  style={{
                    borderBottomWidth:
                      index < (myComplaints || []).slice(0, 3).length - 1
                        ? 1
                        : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center mb-2">
                      <Text
                        className="text-xs font-bold mr-2"
                        style={{ color: colors.primary }}
                      >
                        #{item.ticketId}
                      </Text>
                      <View
                        className="px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: `${getStatusColor(item.status, colors)}20`,
                        }}
                      >
                        <Text
                          className="text-[10px] font-bold capitalize"
                          style={{
                            color: getStatusColor(item.status, colors),
                          }}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="text-sm font-semibold mb-1"
                      style={{ color: colors.textPrimary }}
                      numberOfLines={1}
                    >
                      {item.title || "Complaint"}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={1}
                    >
                      {item.department} • {item.priority}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </View>
              </PressableBlock>
            ))
          )}
        </View>
      </View>

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
