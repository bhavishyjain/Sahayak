import { useRouter } from "expo-router";
import {
  Clock,
  MapPin,
  Star,
  CheckCircle,
  Calendar,
  Filter,
  X,
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
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import { useTheme } from "../../../utils/context/theme";
import apiCall from "../../../utils/api";
import { WORKER_COMPLETED_URL } from "../../../url";

export default function WorkerCompleted() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: WORKER_COMPLETED_URL,
      });

      const payload = res?.data;
      const data = payload?.complaints || [];
      setComplaints(data);
      setFilteredComplaints(data);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2:
          e?.response?.data?.message || "Could not load completed complaints",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [startDate, endDate, complaints]);

  const applyFilters = () => {
    let filtered = [...complaints];

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter((c) => new Date(c.updatedAt) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((c) => new Date(c.updatedAt) <= end);
    }

    setFilteredComplaints(filtered);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setShowFilters(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            Loading completed work...
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
      <BackButtonHeader title="Completed Work" hasBackButton={true} />

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
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Stats Card */}
        {complaints.length > 0 && (
          <Card style={{ margin: 0, marginTop: 16, marginBottom: 16, flex: 0 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: colors.success + "20" || "#10B98120",
                  }}
                >
                  <CheckCircle size={24} color={colors.success || "#10B981"} />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-xs"
                    style={{ color: colors.textSecondary }}
                  >
                    Completed Tasks
                  </Text>
                  <Text
                    className="text-2xl font-bold mt-1"
                    style={{ color: colors.textPrimary }}
                  >
                    {filteredComplaints.length}
                  </Text>
                </View>
              </View>
              <PressableBlock onPress={() => setShowFilters(!showFilters)}>
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{
                    backgroundColor:
                      showFilters || startDate || endDate
                        ? colors.primary + "20"
                        : colors.backgroundSecondary,
                  }}
                >
                  <Filter
                    size={20}
                    color={
                      showFilters || startDate || endDate
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                </View>
              </PressableBlock>
            </View>
          </Card>
        )}

        {/* Filters Section */}
        {showFilters && (
          <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="text-base font-bold"
                style={{ color: colors.textPrimary }}
              >
                Filter by Date Range
              </Text>
              {(startDate || endDate) && (
                <PressableBlock onPress={clearFilters}>
                  <View className="flex-row items-center">
                    <X size={16} color={colors.textSecondary} />
                    <Text
                      className="text-sm font-semibold ml-1"
                      style={{ color: colors.textSecondary }}
                    >
                      Clear
                    </Text>
                  </View>
                </PressableBlock>
              )}
            </View>

            <View
              className="h-[1px] mb-3"
              style={{ backgroundColor: colors.border }}
            />

            <View className="flex-row" style={{ gap: 8 }}>
              <View className="flex-1">
                <Text
                  className="text-xs font-semibold mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  Start Date
                </Text>
                <DateTimePickerModal
                  mode="date"
                  value={startDate}
                  onChange={setStartDate}
                  icon={Calendar}
                  placeholder="Select date"
                  maxDateToday={true}
                />
              </View>

              <View className="flex-1">
                <Text
                  className="text-xs font-semibold mb-2"
                  style={{ color: colors.textSecondary }}
                >
                  End Date
                </Text>
                <DateTimePickerModal
                  mode="date"
                  value={endDate}
                  onChange={setEndDate}
                  icon={Calendar}
                  placeholder="Select date"
                  maxDateToday={true}
                />
              </View>
            </View>

            {filteredComplaints.length !== complaints.length && (
              <View
                className="mt-3 px-3 py-2 rounded-xl"
                style={{ backgroundColor: colors.info + "20" || "#3B82F620" }}
              >
                <Text
                  className="text-xs text-center"
                  style={{ color: colors.info || "#3B82F6" }}
                >
                  Showing {filteredComplaints.length} of {complaints.length}{" "}
                  tasks
                </Text>
              </View>
            )}
          </Card>
        )}

        {filteredComplaints.length === 0 && complaints.length > 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                No tasks found
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                Try adjusting your date filters
              </Text>
            </View>
          </Card>
        ) : complaints.length === 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                No completed complaints
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                Your completed work will appear here
              </Text>
            </View>
          </Card>
        ) : (
          filteredComplaints.map((complaint) => (
            <PressableBlock
              key={complaint.id}
              onPress={() =>
                router.push(`/complaints/complaint-details?id=${complaint.id}`)
              }
            >
              <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                <View className="flex-row justify-between items-start mb-2">
                  <Text
                    className="text-lg font-bold flex-1"
                    style={{ color: colors.primary }}
                  >
                    #{complaint.ticketId}
                  </Text>
                  {complaint.feedback?.rating && (
                    <View className="flex-row items-center">
                      <Star
                        size={14}
                        color={colors.primary}
                        fill={colors.primary}
                      />
                      <Text
                        className="text-xs font-semibold ml-1"
                        style={{ color: colors.primary }}
                      >
                        {complaint.feedback.rating}/5
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  className="text-base font-semibold mb-1"
                  style={{ color: colors.textPrimary }}
                >
                  {complaint.title}
                </Text>

                <Text
                  className="text-sm mb-3 leading-5"
                  numberOfLines={2}
                  style={{ color: colors.textSecondary }}
                >
                  {complaint.description}
                </Text>

                <View className="flex-row items-center mb-2">
                  <MapPin size={14} color={colors.textSecondary} />
                  <Text
                    className="text-xs ml-1 flex-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {complaint.locationName || "No location"}
                  </Text>
                </View>

                <View className="flex-row items-center">
                  <Clock size={14} color={colors.textSecondary} />
                  <Text
                    className="text-xs ml-1"
                    style={{ color: colors.textSecondary }}
                  >
                    Completed {formatDate(complaint.updatedAt)}
                  </Text>
                </View>
              </Card>
            </PressableBlock>
          ))
        )}
      </ScrollView>
    </View>
  );
}
