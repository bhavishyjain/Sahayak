import { useLocalSearchParams, useRouter } from "expo-router";
import {
  User,
  CheckCircle,
  Clock,
  Star,
  MapPin,
  Calendar,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
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
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import StatusPill from "../../../components/StatusPill";
import { useTheme } from "../../../utils/context/theme";
import apiCall from "../../../utils/api";
import { HOD_WORKERS_URL, HOD_DASHBOARD_URL } from "../../../url";
import { getPriorityColor } from "../../../utils/colorHelpers";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WorkerDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [worker, setWorker] = useState(null);
  const [activeComplaints, setActiveComplaints] = useState([]);
  const [completedComplaints, setCompletedComplaints] = useState([]);
  const [showActiveComplaints, setShowActiveComplaints] = useState(true);
  const [showPastWork, setShowPastWork] = useState(false);

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Fetch worker details and their complaints
      const [workerRes, dashboardRes] = await Promise.all([
        apiCall({
          method: "GET",
          url: HOD_WORKERS_URL,
        }),
        apiCall({
          method: "GET",
          url: HOD_DASHBOARD_URL,
        }),
      ]);

      // Find specific worker
      const workers = workerRes?.data?.workers || [];
      const workerData = workers.find((w) => w.id === id || w._id === id);
      setWorker(workerData || null);

      // Filter complaints for this worker
      const allComplaints = dashboardRes?.data?.complaints || [];
      const active = allComplaints.filter(
        (c) =>
          (c.assignedTo === id || c.assignedTo?._id === id) &&
          ["assigned", "in-progress"].includes(c.status),
      );
      const completed = allComplaints.filter(
        (c) =>
          (c.assignedTo === id || c.assignedTo?._id === id) &&
          ["resolved", "closed"].includes(c.status),
      );

      setActiveComplaints(active);
      setCompletedComplaints(completed.slice(0, 20)); // Limit to 20 recent
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not load worker details",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (id) {
      load(false);
    }
  }, [id]);

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title="Worker Details" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            Loading details...
          </Text>
        </View>
      </View>
    );
  }

  if (!worker) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title="Worker Details" />
        <View className="flex-1 justify-center items-center p-6">
          <User size={48} color={colors.textSecondary} />
          <Text
            className="text-lg font-bold mt-4"
            style={{ color: colors.textPrimary }}
          >
            Worker Not Found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}
      edges={["top"]}
    >
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title="Worker Details" />

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
          {/* Worker Profile Card */}
          <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
            <View className="items-center mb-4">
              <View
                className="w-20 h-20 rounded-full items-center justify-center mb-3"
                style={{ backgroundColor: colors.primary + "20" }}
              >
                <User size={40} color={colors.primary} />
              </View>
              <Text
                className="text-xl font-bold"
                style={{ color: colors.textPrimary }}
              >
                {worker.fullName || worker.username}
              </Text>
              <Text
                className="text-sm mt-1"
                style={{ color: colors.textSecondary }}
              >
                @{worker.username}
              </Text>

              <View
                className="px-3 py-1 rounded-full mt-2"
                style={{
                  backgroundColor:
                    worker.workStatus === "available"
                      ? colors.success + "20" || "#10B98120"
                      : worker.workStatus === "busy"
                        ? colors.warning + "20" || "#F59E0B20"
                        : colors.textSecondary + "20",
                }}
              >
                <Text
                  className="text-xs font-semibold capitalize"
                  style={{
                    color:
                      worker.workStatus === "available"
                        ? colors.success || "#10B981"
                        : worker.workStatus === "busy"
                          ? colors.warning || "#F59E0B"
                          : colors.textSecondary,
                  }}
                >
                  {worker.workStatus || "offline"}
                </Text>
              </View>
            </View>

            <View
              className="h-[1px] mb-4"
              style={{ backgroundColor: colors.border }}
            />

            {/* Contact Info */}
            <View className="space-y-2">
              <View className="flex-row items-center mb-2">
                <Mail size={16} color={colors.textSecondary} />
                <Text
                  className="text-sm ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {worker.email}
                </Text>
              </View>
              <View className="flex-row items-center mb-2">
                <Phone size={16} color={colors.textSecondary} />
                <Text
                  className="text-sm ml-2"
                  style={{ color: colors.textPrimary }}
                >
                  {worker.phone || "N/A"}
                </Text>
              </View>
              <View className="flex-row items-center">
                <User size={16} color={colors.textSecondary} />
                <Text
                  className="text-sm ml-2 capitalize"
                  style={{ color: colors.textPrimary }}
                >
                  {worker.department} Department
                </Text>
              </View>
            </View>
          </Card>

          {/* Performance Stats */}
          <View className="flex-row mb-4">
            <Card style={{ margin: 0, marginRight: 6, flex: 1 }}>
              <View className="items-center">
                <View className="flex-row items-center mb-1">
                  <Clock size={16} color={colors.warning || "#F59E0B"} />
                  <Text
                    className="text-2xl font-bold ml-1"
                    style={{ color: colors.textPrimary }}
                  >
                    {worker.metrics?.activeComplaints ||
                      activeComplaints.length}
                  </Text>
                </View>
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  Active
                </Text>
              </View>
            </Card>

            <Card style={{ margin: 0, marginLeft: 6, marginRight: 6, flex: 1 }}>
              <View className="items-center">
                <View className="flex-row items-center mb-1">
                  <CheckCircle size={16} color={colors.success || "#10B981"} />
                  <Text
                    className="text-2xl font-bold ml-1"
                    style={{ color: colors.textPrimary }}
                  >
                    {worker.metrics?.completedCount ||
                      worker.performanceMetrics?.totalCompleted ||
                      0}
                  </Text>
                </View>
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  Completed
                </Text>
              </View>
            </Card>

            <Card style={{ margin: 0, marginLeft: 6, flex: 1 }}>
              <View className="items-center">
                <View className="flex-row items-center mb-1">
                  <Star size={16} color={colors.primary} />
                  <Text
                    className="text-2xl font-bold ml-1"
                    style={{ color: colors.textPrimary }}
                  >
                    {worker.rating ? worker.rating.toFixed(1) : "N/A"}
                  </Text>
                </View>
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  Rating
                </Text>
              </View>
            </Card>
          </View>

          {/* Current Assignments */}
          <PressableBlock
            onPress={() => setShowActiveComplaints(!showActiveComplaints)}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                Current Assignments ({activeComplaints.length})
              </Text>
              {showActiveComplaints ? (
                <ChevronUp size={20} color={colors.textPrimary} />
              ) : (
                <ChevronDown size={20} color={colors.textPrimary} />
              )}
            </View>
          </PressableBlock>

          {showActiveComplaints && (
            <>
              {activeComplaints.length === 0 ? (
                <Card style={{ margin: 0, marginBottom: 16 }}>
                  <View className="items-center py-6">
                    <Text
                      className="text-base font-semibold"
                      style={{ color: colors.textSecondary }}
                    >
                      No active assignments
                    </Text>
                  </View>
                </Card>
              ) : (
                activeComplaints.map((complaint) => (
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
                          className="text-base font-bold"
                          style={{ color: colors.primary }}
                        >
                          #{complaint.ticketId}
                        </Text>
                        <StatusPill status={complaint.status} />
                      </View>

                      <Text
                        className="text-base font-semibold mb-2"
                        style={{ color: colors.textPrimary }}
                      >
                        {complaint.title}
                      </Text>

                      <Text
                        className="text-sm mb-3"
                        style={{ color: colors.textSecondary }}
                        numberOfLines={2}
                      >
                        {complaint.description}
                      </Text>

                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1">
                          <MapPin size={14} color={colors.textSecondary} />
                          <Text
                            className="text-xs ml-1 flex-1"
                            style={{ color: colors.textSecondary }}
                            numberOfLines={1}
                          >
                            {complaint.locationName}
                          </Text>
                        </View>

                        <View
                          className="px-2 py-1 rounded ml-2"
                          style={{
                            backgroundColor:
                              getPriorityColor(complaint.priority, colors) +
                              "20",
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{
                              color: getPriorityColor(
                                complaint.priority,
                                colors,
                              ),
                            }}
                          >
                            {complaint.priority}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </PressableBlock>
                ))
              )}
            </>
          )}

          {/* Past Work */}
          <PressableBlock onPress={() => setShowPastWork(!showPastWork)}>
            <View className="flex-row items-center justify-between mb-3 mt-2">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                Past Work ({completedComplaints.length})
              </Text>
              {showPastWork ? (
                <ChevronUp size={20} color={colors.textPrimary} />
              ) : (
                <ChevronDown size={20} color={colors.textPrimary} />
              )}
            </View>
          </PressableBlock>

          {showPastWork && (
            <>
              {completedComplaints.length === 0 ? (
                <Card style={{ margin: 0, marginBottom: 16 }}>
                  <View className="items-center py-6">
                    <Text
                      className="text-base font-semibold"
                      style={{ color: colors.textSecondary }}
                    >
                      No completed work yet
                    </Text>
                  </View>
                </Card>
              ) : (
                completedComplaints.map((complaint) => (
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
                          className="text-base font-bold"
                          style={{ color: colors.success || "#10B981" }}
                        >
                          #{complaint.ticketId}
                        </Text>
                        <StatusPill status={complaint.status} />
                      </View>

                      <Text
                        className="text-base font-semibold mb-2"
                        style={{ color: colors.textPrimary }}
                      >
                        {complaint.title}
                      </Text>

                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <Calendar size={14} color={colors.textSecondary} />
                          <Text
                            className="text-xs ml-1"
                            style={{ color: colors.textSecondary }}
                          >
                            {new Date(complaint.updatedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </Text>
                        </View>

                        <View
                          className="px-2 py-1 rounded"
                          style={{
                            backgroundColor:
                              getPriorityColor(complaint.priority, colors) +
                              "20",
                          }}
                        >
                          <Text
                            className="text-xs font-semibold"
                            style={{
                              color: getPriorityColor(
                                complaint.priority,
                                colors,
                              ),
                            }}
                          >
                            {complaint.priority}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  </PressableBlock>
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
