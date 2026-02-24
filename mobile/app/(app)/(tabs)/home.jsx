import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Flame,
  ListChecks,
  Map,
  MessageCircle,
  Search,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { getStatusColor, getSeverityColor } from "../../../utils/colorHelpers";
import { useTheme } from "../../../utils/context/theme";
import getUserAuth from "../../../utils/userAuth";

export default function HomeScreen() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    stats: { total: 0, pending: 0, inProgress: 0, resolved: 0 },
    recent: [],
  });
  const [spots, setSpots] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [trackId, setTrackId] = useState("");
  const [user, setUser] = useState(null);

  const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:6000/api";

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

      setSummary(summaryRes?.data || { stats: {}, recent: [] });
      setSpots(heatmapRes?.data?.spots || []);
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

  const myComplaints = useMemo(() => {
    const rows = summary?.recent || [];
    if (statusFilter === "all") return rows;
    return rows.filter(
      (item) => String(item.status || "").toLowerCase() === statusFilter,
    );
  }, [summary?.recent, statusFilter]);

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
      label: "Register Complaint",
      icon: FilePlus2,
      onPress: () =>
        Toast.show({
          type: "info",
          text1: "Next",
          text2: "Complaint form page next.",
        }),
    },
    {
      key: "my",
      label: "My Complaints",
      icon: ListChecks,
      onPress: () => setStatusFilter("all"),
    },
    {
      key: "track",
      label: "Track by ID",
      icon: Search,
      onPress: () => {
        const id = trackId.trim();
        if (!id) {
          Toast.show({ type: "info", text1: "Enter ticket ID first" });
          return;
        }
        Toast.show({
          type: "info",
          text1: "Next",
          text2: `Track ${id} page next.`,
        });
      },
    },
    {
      key: "assistant",
      label: "Assistant Chat",
      icon: MessageCircle,
      onPress: () =>
        Toast.show({
          type: "info",
          text1: "Next",
          text2: "Assistant page next.",
        }),
    },
  ];

  const StatCard = ({ icon: Icon, title, value, tone }) => (
    <View
      className="w-[48.5%] rounded-2xl p-3.5 mb-2.5"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center mb-2">
        <Icon size={16} color={tone} />
        <Text className="ml-2 text-xs" style={{ color: colors.textSecondary }}>
          {title}
        </Text>
      </View>
      <Text
        className="text-[26px] font-bold"
        style={{ color: colors.textPrimary }}
      >
        {value ?? 0}
      </Text>
    </View>
  );

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
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <Text
        className="text-[32px] font-extrabold"
        style={{ color: colors.textPrimary }}
      >
        {getGreeting()},
      </Text>
      <Text
        className="text-[32px] font-extrabold mb-4"
        style={{ color: colors.textPrimary }}
      >
        {user?.fullName}
      </Text>
      <View className="flex-row flex-wrap justify-between">
        <StatCard
          icon={ListChecks}
          title="Total"
          value={summary?.stats?.total}
          tone={colors.primary}
        />
        <StatCard
          icon={AlertCircle}
          title="Pending"
          value={summary?.stats?.pending}
          tone={colors.danger}
        />
        <StatCard
          icon={Clock3}
          title="In Progress"
          value={summary?.stats?.inProgress}
          tone={colors.warning}
        />
        <StatCard
          icon={CheckCircle2}
          title="Resolved"
          value={summary?.stats?.resolved}
          tone={colors.success}
        />
      </View>

      <View
        className="mt-1 rounded-2xl p-3"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          className="text-[15px] font-bold mb-1.5"
          style={{ color: colors.textPrimary }}
        >
          Smart reminders
        </Text>
        <Text className="text-[13px]" style={{ color: colors.textSecondary }}>
          {reminders.pendingText}
        </Text>
        <Text
          className="text-[13px] mt-1"
          style={{ color: colors.textSecondary }}
        >
          {reminders.lastUpdatedText}
        </Text>
      </View>

      <View className="mt-3.5">
        <Text
          className="text-lg font-bold mb-2.5"
          style={{ color: colors.textPrimary }}
        >
          My complaints
        </Text>

        <View className="flex-row mb-2.5">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "in-progress", label: "In progress" },
            { key: "resolved", label: "Resolved" },
          ].map((chip) => (
            <PressableBlock
              key={chip.key}
              onPress={() => setStatusFilter(chip.key)}
              className="mr-2 px-3 py-[7px] rounded-full border"
              style={{
                borderColor:
                  statusFilter === chip.key ? colors.primary : colors.border,
                backgroundColor:
                  statusFilter === chip.key
                    ? `${colors.primary}22`
                    : colors.backgroundSecondary,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {chip.label}
              </Text>
            </PressableBlock>
          ))}
        </View>

        {(myComplaints || []).length === 0 && !loading ? (
          <View
            className="rounded-xl border p-3.5"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.backgroundSecondary,
            }}
          >
            <Text style={{ color: colors.textSecondary }}>
              No complaints found.
            </Text>
          </View>
        ) : (
          (myComplaints || []).map((item) => (
            <View
              key={item.id || item.ticketId}
              className="rounded-xl border p-3 mb-2"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.backgroundSecondary,
              }}
            >
              <View className="flex-row justify-between mb-1.5">
                <Text
                  className="font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {item.ticketId}
                </Text>
                <Text
                  className="font-bold capitalize"
                  style={{
                    color: getStatusColor(item.status, colors),
                  }}
                >
                  {item.status}
                </Text>
              </View>
              <Text
                className="text-[13px]"
                style={{ color: colors.textPrimary }}
              >
                {item.title || "Complaint"}
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors.textSecondary }}
              >
                {item.department} | {item.priority} |{" "}
                {item.locationName || "Location not set"}
              </Text>
            </View>
          ))
        )}
      </View>

      <View className="mt-3.5">
        <View className="flex-row items-center mb-2.5">
          <Map size={18} color={colors.primary} />
          <Text
            className="text-lg font-bold ml-2"
            style={{ color: colors.textPrimary }}
          >
            All complaints (city hotspots)
          </Text>
        </View>

        {topHotspots.length === 0 && !loading ? (
          <View
            className="rounded-xl border p-3.5"
            style={{
              borderColor: colors.border,
              backgroundColor: colors.backgroundSecondary,
            }}
          >
            <Text style={{ color: colors.textSecondary }}>
              No hotspot data available.
            </Text>
          </View>
        ) : (
          topHotspots.map((spot, idx) => (
            <View
              key={`${spot.locationName}-${idx}`}
              className="rounded-xl border p-3 mb-2"
              style={{
                borderColor: colors.border,
                backgroundColor: colors.backgroundSecondary,
              }}
            >
              <View className="flex-row justify-between mb-1.5">
                <Text
                  className="font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {spot.locationName}
                </Text>
                <View className="flex-row items-center">
                  <Flame
                    size={14}
                    color={getSeverityColor(spot.severity, colors)}
                  />
                  <Text
                    className="text-xs ml-1 font-bold capitalize"
                    style={{
                      color: getSeverityColor(spot.severity, colors),
                    }}
                  >
                    {spot.severity}
                  </Text>
                </View>
              </View>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                Total: {spot.totalComplaints} | Open: {spot.openComplaints} |
                High: {spot.highPriorityComplaints}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.textSecondary }}
              >
                Department: {spot.topDepartment}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
