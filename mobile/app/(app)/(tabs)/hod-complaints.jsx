import { useRouter } from "expo-router";
import {
  AlertCircle,
  MapPin,
  CheckCircle,
  XCircle,
  Search,
  ThumbsUp,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import StatusPill from "../../../components/StatusPill";
import { HOD_DASHBOARD_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { getPriorityColor } from "../../../utils/colorHelpers";
import { useTheme } from "../../../utils/context/theme";

export default function HodComplaints() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredComplaints = complaints.filter((complaint) => {
    const query = searchQuery.toLowerCase();
    return (
      complaint.ticketId?.toLowerCase().includes(query) ||
      complaint.title?.toLowerCase().includes(query) ||
      complaint.description?.toLowerCase().includes(query) ||
      complaint.locationName?.toLowerCase().includes(query)
    );
  });

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: HOD_DASHBOARD_URL,
      });

      setComplaints(res?.data?.complaints || []);
      setStats(res?.data?.stats || null);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not load complaints.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const onRefresh = () => {
    load(true);
  };

  const renderComplaintItem = ({ item }) => {
    return (
      <PressableBlock
        onPress={() =>
          router.push(`/complaints/complaint-details?id=${item.id}`)
        }
      >
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <View className="flex-row items-start justify-between mb-2">
            <Text
              className="text-base font-bold"
              style={{ color: colors.primary }}
            >
              #{item.ticketId}
            </Text>
            <StatusPill status={item.status} />
          </View>

          <Text
            className="text-base font-semibold mb-2"
            style={{ color: colors.textPrimary }}
          >
            {item.title}
          </Text>

          <Text
            className="text-sm mb-3"
            style={{ color: colors.textSecondary }}
            numberOfLines={2}
          >
            {item.description}
          </Text>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <MapPin size={14} color={colors.textSecondary} />
              <Text
                className="text-xs ml-1 flex-1"
                style={{ color: colors.textSecondary }}
                numberOfLines={1}
              >
                {item.locationName}
              </Text>
            </View>

            <View className="flex-row items-center ml-3">
              {item.assignedTo ? (
                <>
                  <CheckCircle size={14} color={colors.success || "#10B981"} />
                  <Text
                    className="text-xs ml-1 font-semibold"
                    style={{ color: colors.success || "#10B981" }}
                  >
                    Assigned
                  </Text>
                </>
              ) : (
                <>
                  <AlertCircle size={14} color={colors.warning || "#F59E0B"} />
                  <Text
                    className="text-xs ml-1 font-semibold"
                    style={{ color: colors.warning || "#F59E0B" }}
                  >
                    Unassigned
                  </Text>
                </>
              )}
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center">
              <View
                className="px-2 py-1 rounded"
                style={{
                  backgroundColor:
                    getPriorityColor(item.priority, colors) + "20",
                }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{
                    color: getPriorityColor(item.priority, colors),
                  }}
                >
                  {item.priority}
                </Text>
              </View>
              <View className="flex-row items-center ml-2">
                <ThumbsUp size={12} color={colors.textSecondary} />
                <Text
                  className="text-xs ml-1 font-medium"
                  style={{ color: colors.textSecondary }}
                >
                  {item.upvoteCount || 0}
                </Text>
              </View>
            </View>

            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {new Date(item.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
        </Card>
      </PressableBlock>
    );
  };

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title="Manage Complaints" hasBackButton={false} />

        {/* Search Bar */}
        <View className="px-4 pb-4 pt-4">
          <View
            className="flex-row items-center px-4 py-3.5 rounded-2xl"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1.5,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              className="flex-1 ml-3 text-base"
              style={{ color: colors.textPrimary }}
              placeholder="Search by ticket ID, title or location..."
              placeholderTextColor={colors.textSecondary}
              editable={false}
            />
          </View>
        </View>

        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            Loading complaints...
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
      <BackButtonHeader title="Manage Complaints" showBack={false} />

      {/* Search Bar */}
      <View className="px-4 pb-4 pt-4">
        <View
          className="flex-row items-center px-4 py-3.5 rounded-2xl"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1.5,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            className="flex-1 ml-3 text-base"
            style={{ color: colors.textPrimary }}
            placeholder="Search by ticket ID, title or location..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={filteredComplaints}
        renderItem={renderComplaintItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <AlertCircle size={48} color={colors.textSecondary} />
            <Text
              className="text-base mt-3 text-center"
              style={{ color: colors.textSecondary }}
            >
              {searchQuery
                ? "No complaints found"
                : "No complaints in your department"}
            </Text>
          </View>
        }
      />
    </View>
  );
}
