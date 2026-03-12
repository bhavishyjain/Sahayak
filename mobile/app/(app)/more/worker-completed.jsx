import { useRouter } from "expo-router";
import {
  Clock,
  MapPin,
  Star,
  CheckCircle2,
  CalendarDays,
  X,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import SearchBar from "../../../components/SearchBar";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import { WORKER_COMPLETED_URL } from "../../../url";

export default function WorkerCompleted() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
        text1: t("worker.completedWork.failed"),
        text2:
          e?.response?.data?.message || t("worker.completedWork.loadingError"),
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
  }, [startDate, endDate, searchQuery, complaints]);

  const applyFilters = () => {
    let filtered = [...complaints];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.ticketId?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q),
      );
    }

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
    setSearchQuery("");
  };

  const hasActiveFilters = !!startDate || !!endDate || !!searchQuery.trim();

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
            {t("worker.completedWork.loading")}
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
      <BackButtonHeader
        title={t("worker.completedWork.title")}
        hasBackButton={true}
      />

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
        {/* Search bar */}
        <View className="mt-4 mb-3">
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              t("worker.completedWork.search") || "Search by title, ID…"
            }
          />
        </View>

        {/* Date range row */}
        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={startDate}
              onChange={setStartDate}
              icon={CalendarDays}
              placeholder={t("worker.completedWork.startDate") || "From"}
              maxDateToday={true}
            />
          </View>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={endDate}
              onChange={setEndDate}
              icon={CalendarDays}
              placeholder={t("worker.completedWork.endDate") || "To"}
              maxDateToday={true}
            />
          </View>
        </View>

        {/* Count strip */}
        {complaints.length > 0 && (
          <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
            {hasActiveFilters &&
              filteredComplaints.length !== complaints.length && (
                <View
                  className="flex-row items-center px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: (colors.warning || "#F59E0B") + "20",
                  }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: colors.warning || "#F59E0B" }}
                  >
                    {t("worker.completedWork.showing", {
                      filtered: filteredComplaints.length,
                      total: complaints.length,
                    }) || `Showing ${filteredComplaints.length}`}
                  </Text>
                </View>
              )}
          </View>
        )}

        {filteredComplaints.length === 0 && complaints.length > 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.completedWork.noTasksFound")}
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.completedWork.tryAdjustingFilters")}
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
                {t("worker.completedWork.noComplaints")}
              </Text>
              <Text
                className="text-sm mt-2 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("worker.completedWork.noComplaintsDesc")}
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
                    {complaint.locationName ||
                      t("worker.completedWork.noLocation")}
                  </Text>
                </View>

                <View className="flex-row items-center">
                  <Clock size={14} color={colors.textSecondary} />
                  <Text
                    className="text-xs ml-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("worker.completedWork.completed")}{" "}
                    {formatDate(complaint.updatedAt)}
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
