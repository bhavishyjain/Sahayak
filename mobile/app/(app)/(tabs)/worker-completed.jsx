import { useRouter } from "expo-router";
import { Clock, MapPin, Star } from "lucide-react-native";
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
import { useTheme } from "../../../utils/context/theme";
import apiCall from "../../../utils/api";
import { WORKER_COMPLETED_URL } from "../../../url";

const baseUrl = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:6000/api";

export default function WorkerCompleted(){
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: WORKER_COMPLETED_URL,
      });

      setComplaints(res?.data?.complaints || []);
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
      <BackButtonHeader title="Completed Work" hasBackButton={false} />

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
        {complaints.length > 0 && (
          <View className="px-4 pt-4 pb-2">
            <Text
              className="text-sm font-medium"
              style={{ color: colors.textSecondary }}
            >
              {complaints.length} completed{" "}
              {complaints.length === 1 ? "task" : "tasks"}
            </Text>
          </View>
        )}

        {complaints.length === 0 ? (
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
          complaints.map((complaint) => (
            <PressableBlock
              key={complaint.id}
              onPress={() =>
                router.push(
                  `/complaints/complaint-details?id=${complaint.id}`,
                )
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
