import { useRouter } from "expo-router";
import {
  AlertCircle,
  Calendar,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import ComplaintCard from "../../../components/ComplaintCard";
import DateTimePickerModal from "../../../components/DateTimePickerModal";
import SearchBar from "../../../components/SearchBar";
import { HOD_OVERVIEW_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";

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

      const res = await apiCall({ method: "GET", url: HOD_OVERVIEW_URL });
      const resolvedOnly = res.data.complaints.filter(
        (c) => c.status?.toLowerCase() === "resolved",
      );
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
        (c) =>
          c.ticketId?.toLowerCase().includes(query) ||
          c.title?.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.locationName?.toLowerCase().includes(query),
      );
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      list = list.filter((c) => new Date(c.updatedAt) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      list = list.filter((c) => new Date(c.updatedAt) <= end);
    }

    list.sort((a, b) => {
      const da = new Date(a.updatedAt).getTime();
      const db = new Date(b.updatedAt).getTime();
      return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
    });

    return list;
  }, [complaints, searchQuery, startDate, endDate]);

  const renderItem = ({ item }) => (
    <ComplaintCard
      complaint={item}
      onOpen={() =>
        router.push(`/complaints/complaint-details?id=${item._id ?? item.id}`)
      }
    />
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={t("hod.resolvedComplaints.title")}
        hasBackButton={true}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          <View className="px-4 pt-3 pb-2">
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t("hod.resolvedComplaints.searchPlaceholder")}
            />
          </View>

          <View className="px-4 pb-2">
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
            renderItem={renderItem}
            keyExtractor={(item) => item._id ?? item.id}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 8,
              paddingBottom: 120,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-20">
                <AlertCircle size={40} color={colors.textSecondary} />
                <Text
                  className="text-sm mt-3 text-center"
                  style={{ color: colors.textSecondary }}
                >
                  {searchQuery || startDate || endDate
                    ? t("hod.resolvedComplaints.noComplaints")
                    : t("hod.resolvedComplaints.noComplaintsDefault")}
                </Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}
