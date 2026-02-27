import { useRouter } from "expo-router";
import { User, CheckCircle, Clock, Star, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import apiCall from "../../../utils/api";
import { HOD_WORKERS_URL } from "../../../url";

export default function HodWorkersTab() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredWorkers = workers.filter((worker) => {
    const query = searchQuery.toLowerCase();
    return (
      worker.fullName?.toLowerCase().includes(query) ||
      worker.username?.toLowerCase().includes(query) ||
      worker.email?.toLowerCase().includes(query)
    );
  });

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: HOD_WORKERS_URL,
      });

      const payload = res?.data;
      setWorkers(payload?.workers || []);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not load workers",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title="Manage Workers" hasBackButton={false} />

        {/* Search Bar */}
        <View className="px-4 py-4">
          <View
            className="flex-row items-center px-4 py-1 rounded-2xl"
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
              placeholder="Search by name, username or email..."
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
            Loading workers...
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
      <BackButtonHeader title="Manage Workers" hasBackButton={false} />

      {/* Search Bar */}
      <View className="px-4 py-4">
        <View
          className="flex-row items-center px-4 py-1 rounded-2xl"
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
            placeholder="Search by name, username or email..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

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
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {filteredWorkers.length === 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                {searchQuery ? "No workers found" : "No workers found"}
              </Text>
            </View>
          </Card>
        ) : (
          filteredWorkers.map((worker, index) => (
            <PressableBlock
              key={worker.id || index}
              onPress={() => router.push(`/hod/worker-details?id=${worker.id}`)}
            >
              <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                {/* Worker Header */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.primary + "20" }}
                    >
                      <User size={24} color={colors.primary} />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text
                        className="text-base font-bold"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.fullName || worker.username}
                      </Text>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: colors.textSecondary }}
                      >
                        {worker.email}
                      </Text>
                    </View>
                  </View>

                </View>

                {/* Worker Stats */}
                <View className="flex-row justify-between">
                  <View className="flex-1 items-center">
                    <View className="flex-row items-center mb-1">
                      <Clock size={14} color={colors.warning || "#F59E0B"} />
                      <Text
                        className="text-lg font-bold ml-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.activeComplaints || 0}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      Active
                    </Text>
                  </View>

                  <View
                    className="w-[1px]"
                    style={{ backgroundColor: colors.border }}
                  />

                  <View className="flex-1 items-center">
                    <View className="flex-row items-center mb-1">
                      <CheckCircle
                        size={14}
                        color={colors.success || "#10B981"}
                      />
                      <Text
                        className="text-lg font-bold ml-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.completedCount || 0}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      Completed
                    </Text>
                  </View>

                  <View
                    className="w-[1px]"
                    style={{ backgroundColor: colors.border }}
                  />

                  <View className="flex-1 items-center">
                    <View className="flex-row items-center mb-1">
                      <Star size={14} color={colors.primary} />
                      <Text
                        className="text-lg font-bold ml-1"
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
                </View>
              </Card>
            </PressableBlock>
          ))
        )}
      </ScrollView>
    </View>
  );
}
