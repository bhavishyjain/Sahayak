import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Clock,
  MapPin,
  User,
  FileText,
  AlertCircle,
  Image as ImageIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  View,
  Modal,
  Pressable,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import { GET_COMPLAINT_BY_ID_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { getStatusColor, getPriorityColor } from "../../../utils/colorHelpers";
import { useTheme } from "../../../utils/context/theme";

export default function ComplaintDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaint, setComplaint] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: GET_COMPLAINT_BY_ID_URL(id),
      });

      setComplaint(res?.data?.complaint || null);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2:
          e?.response?.data?.message || "Could not load complaint details.",
      });
      // Navigate back if complaint not found
      if (e?.response?.status === 404) {
        setTimeout(() => router.back(), 1500);
      }
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

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatHistoryDate = (dateString) => {
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
        <BackButtonHeader title="Complaint Details" />
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

  if (!complaint) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title="Complaint Details" />
        <View className="flex-1 justify-center items-center p-6">
          <AlertCircle size={48} color={colors.textSecondary} />
          <Text
            className="text-lg font-bold mt-4"
            style={{ color: colors.textPrimary }}
          >
            Complaint Not Found
          </Text>
          <Text
            className="text-sm mt-2 text-center"
            style={{ color: colors.textSecondary }}
          >
            This complaint could not be loaded.
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
      <BackButtonHeader title="Complaint Details" />

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
        {/* Ticket ID Card */}
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <View className="items-center">
            <Text
              className="text-sm mb-1"
              style={{ color: colors.textSecondary }}
            >
              Ticket ID
            </Text>
            <Text
              className="text-2xl font-bold"
              style={{ color: colors.primary }}
            >
              #{complaint.ticketId}
            </Text>
          </View>
        </Card>

        {/* Status and Priority */}
        <View className="flex-row mb-3">
          <Card style={{ margin: 0, marginRight: 6, flex: 1 }}>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Status
            </Text>
            <Text
              className="text-lg font-bold mt-1 capitalize"
              style={{ color: getStatusColor(complaint.status, colors) }}
            >
              {complaint.status || "-"}
            </Text>
          </Card>
          <Card style={{ margin: 0, marginLeft: 6, flex: 1 }}>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Priority
            </Text>
            <Text
              className="text-lg font-bold mt-1"
              style={{ color: getPriorityColor(complaint.priority, colors) }}
            >
              {complaint.priority || "-"}
            </Text>
          </Card>
        </View>

        {/* Title and Description */}
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <View className="flex-row items-start mb-3">
            <FileText
              size={20}
              color={colors.primary}
              style={{ marginTop: 2 }}
            />
            <View className="flex-1 ml-3">
              <Text
                className="text-sm mb-1"
                style={{ color: colors.textSecondary }}
              >
                Title
              </Text>
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {complaint.title || "Complaint"}
              </Text>
            </View>
          </View>

          <View
            className="h-[1px] mb-3"
            style={{ backgroundColor: colors.border }}
          />

          <View>
            <Text
              className="text-sm mb-1"
              style={{ color: colors.textSecondary }}
            >
              Description
            </Text>
            <Text
              className="text-base leading-6"
              style={{ color: colors.textPrimary }}
            >
              {complaint.description || "No description provided"}
            </Text>
          </View>
        </Card>

        {/* Department and Location */}
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <View className="flex-row items-start mb-3">
            <User size={20} color={colors.primary} style={{ marginTop: 2 }} />
            <View className="flex-1 ml-3">
              <Text
                className="text-sm mb-1"
                style={{ color: colors.textSecondary }}
              >
                Department
              </Text>
              <Text
                className="text-base font-semibold capitalize"
                style={{ color: colors.textPrimary }}
              >
                {complaint.department || "-"}
              </Text>
            </View>
          </View>

          <View
            className="h-[1px] mb-3"
            style={{ backgroundColor: colors.border }}
          />

          <View className="flex-row items-start">
            <MapPin size={20} color={colors.primary} style={{ marginTop: 2 }} />
            <View className="flex-1 ml-3">
              <Text
                className="text-sm mb-1"
                style={{ color: colors.textSecondary }}
              >
                Location
              </Text>
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textPrimary }}
              >
                {complaint.locationName || "Not specified"}
              </Text>
              {complaint.coordinates && (
                <Text
                  className="text-xs mt-1"
                  style={{ color: colors.textSecondary }}
                >
                  {complaint.coordinates.lat?.toFixed(6)},{" "}
                  {complaint.coordinates.lng?.toFixed(6)}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Proof Image */}
        {complaint.proofImage && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <View className="flex-row items-center mb-3">
              <ImageIcon size={20} color={colors.primary} />
              <Text
                className="text-base font-semibold ml-2"
                style={{ color: colors.textPrimary }}
              >
                Proof Image
              </Text>
            </View>
            <PressableBlock onPress={() => setImageModalVisible(true)}>
              <Image
                source={{ uri: complaint.proofImage }}
                className="w-full h-48 rounded-xl"
                resizeMode="cover"
              />
              <View className="absolute inset-0 items-center justify-center bg-black/10 rounded-xl">
                <View
                  className="px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: colors.backgroundPrimary }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    Tap to view full size
                  </Text>
                </View>
              </View>
            </PressableBlock>
          </Card>
        )}

        {/* Timeline */}
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <View className="flex-row items-center mb-3">
            <Clock size={20} color={colors.primary} />
            <Text
              className="text-base font-semibold ml-2"
              style={{ color: colors.textPrimary }}
            >
              Timeline
            </Text>
          </View>

          <View className="mb-3">
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Created
            </Text>
            <Text
              className="text-base font-semibold mt-1"
              style={{ color: colors.textPrimary }}
            >
              {formatDate(complaint.createdAt)}
            </Text>
          </View>

          <View
            className="h-[1px] mb-3"
            style={{ backgroundColor: colors.border }}
          />

          <View>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Last Updated
            </Text>
            <Text
              className="text-base font-semibold mt-1"
              style={{ color: colors.textPrimary }}
            >
              {formatDate(complaint.updatedAt)}
            </Text>
          </View>
        </Card>

        {/* History */}
        {complaint.history && complaint.history.length > 0 && (
          <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
            <Text
              className="text-base font-semibold mb-3"
              style={{ color: colors.textPrimary }}
            >
              Status History
            </Text>
            {complaint.history.map((item, index) => (
              <View key={index}>
                {index > 0 && (
                  <View
                    className="h-[1px] my-3"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text
                      className="text-sm font-semibold capitalize"
                      style={{ color: colors.textPrimary }}
                    >
                      {item.status}
                    </Text>
                    {item.note && (
                      <Text
                        className="text-xs mt-1"
                        style={{ color: colors.textSecondary }}
                      >
                        {item.note}
                      </Text>
                    )}
                  </View>
                  <Text
                    className="text-xs ml-2"
                    style={{ color: colors.textSecondary }}
                  >
                    {formatHistoryDate(item.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Full Image Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View
          className="flex-1"
          style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
        >
          <View className="flex-1 justify-center items-center">
            <Pressable
              onPress={() => setImageModalVisible(false)}
              className="absolute top-12 right-4 z-10 w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <Text className="text-white text-2xl font-bold">×</Text>
            </Pressable>
            <Image
              source={{ uri: complaint.proofImage }}
              className="w-full h-full"
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
