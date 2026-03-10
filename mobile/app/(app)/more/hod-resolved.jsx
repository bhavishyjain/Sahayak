import { useRouter } from "expo-router";
import {
  AlertCircle,
  MapPin,
  Search,
  ThumbsUp,
  Clock,
  Calendar,
} from "lucide-react-native";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useEffect, useMemo, useState } from "react";
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
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import PressableBlock from "../../../components/PressableBlock";
import StatusPill from "../../../components/StatusPill";
import { HOD_OVERVIEW_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { getPriorityColor } from "../../../utils/colorHelpers";
import { useTheme } from "../../../utils/context/theme";

export default function HodResolvedComplaints() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: HOD_OVERVIEW_URL,
      });

      const payload = res?.data;
      const resolvedOnly = (payload?.complaints || []).filter((complaint) => {
        const status = (complaint?.status || "").toLowerCase();
        return status === "resolved";
      });
      setComplaints(resolvedOnly);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.resolvedComplaints.failed"),
        text2:
          e?.response?.data?.message ||
          t("hod.resolvedComplaints.loadingError"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const filteredComplaints = useMemo(() => {
    let list = [...complaints];

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (complaint) =>
          complaint.ticketId?.toLowerCase().includes(query) ||
          complaint.title?.toLowerCase().includes(query) ||
          complaint.description?.toLowerCase().includes(query) ||
          complaint.locationName?.toLowerCase().includes(query),
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      list = list.filter(
        (complaint) =>
          new Date(complaint.updatedAt || complaint.createdAt) >= start,
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      list = list.filter(
        (complaint) =>
          new Date(complaint.updatedAt || complaint.createdAt) <= end,
      );
    }

    list.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      const safeA = Number.isNaN(dateA) ? 0 : dateA;
      const safeB = Number.isNaN(dateB) ? 0 : dateB;
      return safeB - safeA;
    });

    return list;
  }, [complaints, searchQuery, startDate, endDate]);

  const renderComplaintItem = ({ item }) => (
    <PressableBlock
      onPress={() => router.push(`/complaints/complaint-details?id=${item.id}`)}
      style={{ marginBottom: 12 }}
    >
      <Card style={{ margin: 0, flex: 0 }}>
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

        <View className="flex-row items-center mb-2">
          <MapPin size={14} color={colors.textSecondary} />
          <Text
            className="text-xs ml-1 flex-1"
            style={{ color: colors.textSecondary }}
            numberOfLines={1}
          >
            {item.locationName}
          </Text>
        </View>

        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center">
            <View
              className="px-2 py-1 rounded"
              style={{
                backgroundColor: getPriorityColor(item.priority, colors) + "20",
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: getPriorityColor(item.priority, colors) }}
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

          <View className="flex-row items-center">
            <Clock size={12} color={colors.textSecondary} />
            <Text
              className="text-xs ml-1"
              style={{ color: colors.textSecondary }}
            >
              {new Date(item.updatedAt || item.createdAt).toLocaleString(
                "en-US",
                {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </Text>
          </View>
        </View>
      </Card>
    </PressableBlock>
  );

  if (loading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={t("hod.resolvedComplaints.title")}
        hasBackButton={true}
      />

      <View className="px-4 pt-4 pb-2">
        <View
          className="flex-row items-center px-4 py-1 rounded-xl"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1.5,
            borderColor: colors.border,
          }}
        >
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            className="flex-1 ml-3 text-base"
            style={{ color: colors.textPrimary }}
            placeholder={t("hod.resolvedComplaints.searchPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View className="px-4 my-3">
        <View className="flex-row" style={{ gap: 8 }}>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={startDate}
              onChange={setStartDate}
              icon={Calendar}
              placeholder={t("hod.resolvedComplaints.startDate")}
              maxDateToday={true}
              containerStyle={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1.5,
                borderColor: colors.border,
                marginBottom: 0,
              }}
            />
          </View>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={endDate}
              onChange={setEndDate}
              icon={Calendar}
              placeholder={t("hod.resolvedComplaints.endDate")}
              maxDateToday={true}
              containerStyle={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1.5,
                borderColor: colors.border,
                marginBottom: 0,
              }}
            />
          </View>
        </View>
      </View>

      <FlatList
        data={filteredComplaints}
        renderItem={renderComplaintItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
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
              {searchQuery || startDate || endDate
                ? t("hod.resolvedComplaints.noComplaints")
                : t("hod.resolvedComplaints.noComplaintsDefault")}
            </Text>
          </View>
        }
      />
    </View>
  );
}
