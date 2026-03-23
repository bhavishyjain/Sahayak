import { Star, MessageSquareText } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
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
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import { WORKER_FEEDBACK_URL } from "../../../url";

function Stars({ value, colors }) {
  return (
    <View className="flex-row items-center" style={{ gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fillRatio = Math.max(0, Math.min(1, value - (star - 1)));
        return (
          <View
            key={star}
            style={{ width: 16, height: 16, position: "relative" }}
          >
            <Star size={16} color={colors.warning} fill="transparent" />
            {fillRatio > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 16 * fillRatio,
                  height: 16,
                  overflow: "hidden",
                }}
              >
                <Star size={16} color={colors.warning} fill={colors.warning} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function WorkerFeedback() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState({
    averageRating: 0,
    totalFeedback: 0,
  });
  const [feedback, setFeedback] = useState([]);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const response = await apiCall({
          method: "GET",
          url: WORKER_FEEDBACK_URL,
        });
        setSummary(
          response?.data?.summary ?? { averageRating: 0, totalFeedback: 0 },
        );
        setFeedback(response?.data?.feedback ?? []);
      } catch (error) {
        Toast.show({
          type: "error",
          text1: t("more.workerFeedbackScreen.failedTitle"),
          text2:
            error?.response?.data?.message ??
            t("more.workerFeedbackScreen.failedMessage"),
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title={t("more.workerFeedbackScreen.title")} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("more.workerFeedbackScreen.title")} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
          <Text
            className="text-sm mb-2"
            style={{ color: colors.textSecondary }}
          >
            {t("more.workerFeedbackScreen.currentRating")}
          </Text>
          <View className="flex-row items-center justify-between">
            <View>
              <Text
                className="text-3xl font-bold"
                style={{ color: colors.textPrimary }}
              >
                {summary.averageRating
                  ? summary.averageRating.toFixed(1)
                  : "0.0"}
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors.textSecondary }}
              >
                {t("more.workerFeedbackScreen.feedbackEntries", {
                  count: summary.totalFeedback,
                })}
              </Text>
            </View>
            <Stars value={summary.averageRating} colors={colors} />
          </View>
        </Card>

        {feedback.length === 0 ? (
          <Card style={{ margin: 0, flex: 0 }}>
            <View className="items-center py-8">
              <MessageSquareText size={28} color={colors.textSecondary} />
              <Text
                className="text-base font-semibold mt-3"
                style={{ color: colors.textPrimary }}
              >
                {t("more.workerFeedbackScreen.emptyTitle")}
              </Text>
              <Text
                className="text-sm mt-1 text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("more.workerFeedbackScreen.emptyDescription")}
              </Text>
            </View>
          </Card>
        ) : (
          feedback.map((item) => (
            <Card
              key={item.complaintId}
              style={{ margin: 0, marginBottom: 12, flex: 0 }}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 pr-3">
                  <Text className="text-xs" style={{ color: colors.primary }}>
                    #{item.ticketId}
                  </Text>
                  <Text
                    className="text-base font-semibold mt-1"
                    style={{ color: colors.textPrimary }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("more.workerFeedbackScreen.byCitizen", {
                      name: item.citizenName,
                    })}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className="text-lg font-bold"
                    style={{ color: colors.warning }}
                  >
                    {item.rating}/5
                  </Text>
                  <Stars value={item.rating} colors={colors} />
                </View>
              </View>
              {item.comment ? (
                <Text
                  className="text-sm leading-6"
                  style={{ color: colors.textPrimary }}
                >
                  {item.comment}
                </Text>
              ) : (
                <Text
                  className="text-sm italic"
                  style={{ color: colors.textSecondary }}
                >
                  {t("more.workerFeedbackScreen.noComment")}
                </Text>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
