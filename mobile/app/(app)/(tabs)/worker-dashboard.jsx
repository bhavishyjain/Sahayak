import { useRouter } from "expo-router";
import {
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ClipboardList,
  Star,
  Activity,
} from "lucide-react-native";
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
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import apiCall from "../../../utils/api";
import getUserAuth from "../../../utils/userAuth";
import { WORKER_DASHBOARD_URL } from "../../../url";
import { getPriorityColor } from "../../../utils/colorHelpers";

export default function WorkerDashboard() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [user, setUser] = useState(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    if (hour < 21) return "Good Evening";
    return "Good Night";
  };

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: WORKER_DASHBOARD_URL,
      });

      console.log(
        "📱 [Frontend] Response:",
        JSON.stringify(res?.data, null, 2),
      );

      if (res?.data?.data) {
        // Backend returns { success: true, data: { assignedComplaints, statistics } }
        const backendData = res.data.data;
        const transformed = {
          activeCount: backendData.statistics?.activeComplaints || 0,
          completedCount: backendData.statistics?.totalCompleted || 0,
          weekCompleted: backendData.statistics?.weekCompleted || 0,
          activeComplaints: (backendData.assignedComplaints || []).map((c) => ({
            id: c._id,
            ticketId: c.ticketId,
            title: c.title || c.rawText?.split(":")[0] || "Complaint",
            description: c.description || c.refinedText || c.rawText,
            priority: c.priority,
            status: c.status,
          })),
        };
        console.log(
          "📱 [Frontend] Transformed:",
          JSON.stringify(transformed, null, 2),
        );
        setDashboardData(transformed);
      }
    } catch (e) {
      console.error("📱 [Frontend] Error:", e);
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not load dashboard",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
    getUserAuth().then((userData) => {
      if (userData) {
        setUser(userData);
      }
    });
  }, []);

  if (loading) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-sm mt-3" style={{ color: colors.textSecondary }}>
          Loading dashboard...
        </Text>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View className="px-4 pt-12 pb-6">
          <Text className="text-sm" style={{ color: colors.textSecondary }}>
            {getGreeting()}
          </Text>
          <Text
            className="text-2xl font-bold mt-1"
            style={{ color: colors.textPrimary }}
          >
            {user?.fullName || "Worker"}
          </Text>
          <Text
            className="text-sm mt-1"
            style={{ color: colors.textSecondary }}
          >
            {user?.department || ""} Department
          </Text>
        </View>

        {/* Statistics Grid */}
        {dashboardData && (
          <View className="px-4">
            {/* Work Status Cards */}
            <View className="flex-row mb-4">
              <Card style={{ margin: 0, marginRight: 6, flex: 1 }}>
                <View className="flex-row items-center mb-2">
                  <Clock size={16} color={colors.warning || "#F59E0B"} />
                  <Text
                    className="text-xs ml-2 font-semibold"
                    style={{ color: colors.textSecondary }}
                  >
                    Active
                  </Text>
                </View>
                <Text
                  className="text-3xl font-bold"
                  style={{ color: colors.warning || "#F59E0B" }}
                >
                  {dashboardData.activeCount || 0}
                </Text>
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.textSecondary }}
                >
                  Assigned to you
                </Text>
              </Card>

              <Card style={{ margin: 0, marginLeft: 6, flex: 1 }}>
                <View className="flex-row items-center mb-2">
                  <CheckCircle size={16} color={colors.success || "#10B981"} />
                  <Text
                    className="text-xs ml-2 font-semibold"
                    style={{ color: colors.textSecondary }}
                  >
                    Completed
                  </Text>
                </View>
                <Text
                  className="text-3xl font-bold"
                  style={{ color: colors.success || "#10B981" }}
                >
                  {dashboardData.completedCount || 0}
                </Text>
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.textSecondary }}
                >
                  Total resolved
                </Text>
              </Card>
            </View>

            {/* Performance Card */}
            <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
              <View className="flex-row items-center mb-3">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.primary + "20" }}
                >
                  <TrendingUp size={20} color={colors.primary} />
                </View>
                <Text
                  className="text-base font-semibold ml-3"
                  style={{ color: colors.textPrimary }}
                >
                  Performance Metrics
                </Text>
              </View>

              <View
                className="h-[1px] mb-3"
                style={{ backgroundColor: colors.border }}
              />

              <View className="flex-row justify-between">
                <View className="flex-1 items-center px-2">
                  <View className="flex-row items-center mb-1">
                    <Star size={14} color={colors.primary} />
                    <Text
                      className="text-xs ml-1 font-semibold"
                      style={{ color: colors.textSecondary }}
                    >
                      Rating
                    </Text>
                  </View>
                  <Text
                    className="text-2xl font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {user?.rating ? user.rating.toFixed(1) : "4.5"}
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors.textSecondary }}
                  >
                    out of 5
                  </Text>
                </View>

                <View
                  className="w-[1px]"
                  style={{ backgroundColor: colors.border }}
                />

                <View className="flex-1 items-center px-2">
                  <View className="flex-row items-center mb-1">
                    <Activity size={14} color={colors.info || "#3B82F6"} />
                    <Text
                      className="text-xs ml-1 font-semibold"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={1}
                    >
                      Week
                    </Text>
                  </View>
                  <Text
                    className="text-2xl font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {dashboardData?.weekCompleted || 0}
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors.textSecondary }}
                  >
                    completed
                  </Text>
                </View>
              </View>
            </Card>

            {/* Active Assignments Section */}
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                Active Assignments
              </Text>
              <PressableBlock onPress={() => router.push("/worker-assigned")}>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.primary }}
                >
                  View All
                </Text>
              </PressableBlock>
            </View>

            {dashboardData.activeComplaints &&
            dashboardData.activeComplaints.length > 0 ? (
              dashboardData.activeComplaints.slice(0, 3).map((complaint) => (
                <PressableBlock
                  key={complaint.id}
                  onPress={() =>
                    router.push(
                      `/complaints/complaint-details?id=${complaint.id}`,
                    )
                  }
                >
                  <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                    <View className="flex-row items-start justify-between mb-2">
                      <Text
                        className="text-sm font-bold"
                        style={{ color: colors.primary }}
                      >
                        #{complaint.ticketId}
                      </Text>
                      <View
                        className="px-2 py-1 rounded"
                        style={{
                          backgroundColor:
                            getPriorityColor(complaint.priority, colors) + "20",
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{
                            color: getPriorityColor(complaint.priority, colors),
                          }}
                        >
                          {complaint.priority}
                        </Text>
                      </View>
                    </View>

                    <Text
                      className="text-base font-semibold mb-2"
                      style={{ color: colors.textPrimary }}
                    >
                      {complaint.title}
                    </Text>

                    <Text
                      className="text-sm mb-2"
                      style={{ color: colors.textSecondary }}
                      numberOfLines={2}
                    >
                      {complaint.description}
                    </Text>

                    <View className="flex-row items-center">
                      <ClipboardList size={12} color={colors.textSecondary} />
                      <Text
                        className="text-xs ml-1 capitalize"
                        style={{ color: colors.textSecondary }}
                      >
                        {complaint.status?.replace("-", " ")}
                      </Text>
                    </View>
                  </Card>
                </PressableBlock>
              ))
            ) : (
              <Card style={{ margin: 0, marginBottom: 16 }}>
                <View className="items-center py-6">
                  <AlertCircle size={32} color={colors.textSecondary} />
                  <Text
                    className="text-base font-semibold mt-3"
                    style={{ color: colors.textSecondary }}
                  >
                    No active assignments
                  </Text>
                  <Text
                    className="text-sm mt-1 text-center"
                    style={{ color: colors.textSecondary }}
                  >
                    You're all caught up! New assignments will appear here.
                  </Text>
                </View>
              </Card>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
