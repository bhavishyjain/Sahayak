import { useRouter } from "expo-router";
import { CalendarDays, Inbox, SearchX } from "lucide-react-native";
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
import ComplaintCard from "../../../components/ComplaintCard";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import SearchBar from "../../../components/SearchBar";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
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

      const payload = res.data;
      const data = payload.complaints;
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
    let filtered = [...complaints];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (complaint) =>
          complaint.ticketId?.toLowerCase().includes(query) ||
          complaint.title?.toLowerCase().includes(query) ||
          complaint.description?.toLowerCase().includes(query),
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(
        (complaint) => new Date(complaint.updatedAt) >= start,
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (complaint) => new Date(complaint.updatedAt) <= end,
      );
    }

    setFilteredComplaints(filtered);
  }, [complaints, searchQuery, startDate, endDate]);

  const hasActiveFilters = !!startDate || !!endDate || !!searchQuery.trim();

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
        <View className="mt-4 mb-3">
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("worker.completedWork.search")}
          />
        </View>

        <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={startDate}
              onChange={setStartDate}
              icon={CalendarDays}
              placeholder={t("worker.completedWork.startDate")}
              maxDateToday={true}
            />
          </View>
          <View className="flex-1">
            <DateTimePickerModal
              mode="date"
              value={endDate}
              onChange={setEndDate}
              icon={CalendarDays}
              placeholder={t("worker.completedWork.endDate")}
              maxDateToday={true}
            />
          </View>
        </View>

        {complaints.length > 0 && (
          <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
            {hasActiveFilters &&
              filteredComplaints.length !== complaints.length && (
                <View
                  className="flex-row items-center px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: colors.warning + "20",
                  }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: colors.warning }}
                  >
                    {t("worker.completedWork.showing", {
                      filtered: filteredComplaints.length,
                      total: complaints.length,
                    })}
                  </Text>
                </View>
              )}
          </View>
        )}

        {filteredComplaints.length === 0 && complaints.length > 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <SearchX size={20} color={colors.textSecondary} />
              <Text
                className="text-base font-semibold mt-2"
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
              <Inbox size={20} color={colors.textSecondary} />
              <Text
                className="text-base font-semibold mt-2"
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
          filteredComplaints.map((complaint, index) => (
            <ComplaintCard
              key={`${complaint._id ?? complaint.id ?? index}`}
              complaint={complaint}
              onOpen={() =>
                router.push(
                  `/complaints/complaint-details?id=${complaint._id ?? complaint.id}`,
                )
              }
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
