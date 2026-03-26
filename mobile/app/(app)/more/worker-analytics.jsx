import { useLocalSearchParams } from "expo-router";
import {
  ActivitySquare,
  BarChart2,
  CheckCircle,
  Clock3,
  Star,
  Target,
} from "lucide-react-native";
import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import { useTheme } from "../../../utils/context/theme";
import {
  ALL_STATUS_OPTIONS,
  formatPriorityLabel,
  formatStatusLabel,
  getPriorityColor,
  getStatusColor,
} from "../../../data/complaintStatus";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { useWorkerAnalytics } from "../../../utils/hooks/useWorkerAnalytics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function MetricPanel({ label, value, hint, icon: Icon, tone, colors }) {
  return (
    <View
      className="rounded-2xl p-4 flex-1"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text
            className="text-xs font-semibold"
            style={{ color: colors.textSecondary }}
          >
            {label}
          </Text>
          <Text
            className="text-2xl font-bold mt-2"
            style={{ color: colors.textPrimary }}
          >
            {value}
          </Text>
          {hint ? (
            <Text
              className="text-xs mt-2 leading-5"
              style={{ color: colors.textSecondary }}
            >
              {hint}
            </Text>
          ) : null}
        </View>
        <View
          className="w-12 h-12 rounded-[18px] items-center justify-center"
          style={{ backgroundColor: tone + "18" }}
        >
          <Icon size={20} color={tone} />
        </View>
      </View>
    </View>
  );
}

function SummaryTile({ label, value, hint, icon: Icon, tone, colors }) {
  return (
    <View
      className="rounded-2xl p-4 flex-1"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-start justify-between">
        <Text
          className="text-xs font-semibold flex-1 pr-3"
          style={{ color: colors.textSecondary }}
        >
          {label}
        </Text>
        <View
          className="w-10 h-10 rounded-2xl items-center justify-center"
          style={{ backgroundColor: tone + "18" }}
        >
          <Icon size={18} color={tone} />
        </View>
      </View>
      <Text
        className="text-3xl font-bold"
        style={{ color: colors.textPrimary }}
      >
        {value}
      </Text>
      {hint ? (
        <Text
          className="text-xs mt-2 leading-5"
          style={{ color: colors.textSecondary }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function WeeklyStripChart({ data, colors }) {
  const outerPadding = 32;
  const cardPadding = 20;
  const width = SCREEN_WIDTH - outerPadding - cardPadding;
  const chartHeight = 150;
  const labelHeight = 24;
  const totalHeight = chartHeight + labelHeight;
  const maxValue = Math.max(...data.map((item) => item.count), 1);
  const count = data.length || 1;
  const gap = 8;
  const barWidth = (width - gap * (count - 1)) / count;

  return (
    <Svg width={width} height={totalHeight}>
      {[0.25, 0.5, 0.75, 1].map((fraction, index) => {
        const y = chartHeight - fraction * chartHeight;
        return (
          <Line
            key={index}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke={colors.border}
            strokeWidth={0.6}
          />
        );
      })}

      {data.map((item, index) => {
        const x = index * (barWidth + gap);
        const height = (item.count / maxValue) * (chartHeight - 14);
        const y = chartHeight - height;
        const fill = item.count > 0 ? colors.primary : colors.border;

        return (
          <G key={`${item.label}-${index}`}>
            <Rect
              x={x}
              y={item.count > 0 ? y : chartHeight - 2}
              width={barWidth}
              height={item.count > 0 ? height : 2}
              rx={5}
              fill={fill}
              opacity={item.count > 0 ? 1 : 0.6}
            />
            <SvgText
              x={x + barWidth / 2}
              y={totalHeight - 6}
              textAnchor="middle"
              fontSize={8}
              fill={colors.textSecondary}
            >
              {item.label}
            </SvgText>
            {item.count > 0 ? (
              <SvgText
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                fontSize={9}
                fill={colors.primary}
                fontWeight="700"
              >
                {item.count}
              </SvgText>
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}

function PriorityLane({ breakdown, config, colors }) {
  const total = config.reduce(
    (sum, item) => sum + Number(breakdown?.[item.key] || 0),
    0,
  );

  return (
    <View>
      <View
        className="h-5 rounded-full overflow-hidden flex-row"
        style={{ backgroundColor: colors.border }}
      >
        {total > 0
          ? config.map((item) => {
              const count = Number(breakdown?.[item.key] || 0);
              const flex = count / total;
              if (flex <= 0) return null;
              return (
                <View
                  key={item.key}
                  style={{ flex, backgroundColor: item.color }}
                />
              );
            })
          : null}
      </View>

      <View className="mt-4">
        {config.map((item) => (
          <View
            key={item.key}
            className="flex-row items-center justify-between mb-3"
          >
            <View className="flex-row items-center">
              <View
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: item.color }}
              />
              <Text
                className="text-sm font-medium"
                style={{ color: colors.textPrimary }}
              >
                {item.label}
              </Text>
            </View>
            <Text
              className="text-sm font-bold"
              style={{ color: colors.textSecondary }}
            >
              {Number(breakdown?.[item.key] || 0)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatusMeter({ label, count, total, tone, colors }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View
            className="w-2.5 h-2.5 rounded-full mr-2"
            style={{ backgroundColor: tone }}
          />
          <Text
            className="text-sm font-medium"
            style={{ color: colors.textPrimary }}
          >
            {label}
          </Text>
        </View>
        <Text
          className="text-xs font-semibold"
          style={{ color: colors.textSecondary }}
        >
          {count} · {pct}%
        </Text>
      </View>
      <View
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: colors.border }}
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: tone }}
        />
      </View>
    </View>
  );
}

export default function WorkerAnalytics() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const { workerId } = useLocalSearchParams();
  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );

  const {
    data,
    isLoading: loading,
    isRefetching: refreshing,
    error,
    refetch,
  } = useWorkerAnalytics(workerId);

  useEffect(() => {
    if (!error) return;
    Toast.show({
      type: "error",
      text1: t("more.workerAnalyticsScreen.failedTitle"),
      text2:
        error?.response?.data?.message ??
        t("more.workerAnalyticsScreen.failedMessage"),
    });
  }, [error, t]);

  const title = workerId
    ? data?.worker?.fullName
      ? t("more.workerAnalyticsScreen.titleForWorker", {
          name: data.worker.fullName,
        })
      : t("more.workerAnalyticsScreen.titleWorker")
    : t("more.menu.workerAnalytics.title");

  const priorityConfig = useMemo(
    () => [
      {
        key: "High",
        label: formatPriorityLabel(t, "High"),
        color: getPriorityColor("High", colors) ?? colors.danger,
      },
      {
        key: "Medium",
        label: formatPriorityLabel(t, "Medium"),
        color: getPriorityColor("Medium", colors) ?? colors.warning,
      },
      {
        key: "Low",
        label: formatPriorityLabel(t, "Low"),
        color: getPriorityColor("Low", colors) ?? colors.success,
      },
    ],
    [colors, t],
  );

  const statusConfig = useMemo(
    () =>
      ALL_STATUS_OPTIONS.map((key) => ({
        key,
        label: formatStatusLabel(t, key),
        color: getStatusColor(key, colors) ?? colors.textSecondary,
      })),
    [colors, t],
  );

  const totalStatusCount = Object.values(data?.statusDistribution ?? {}).reduce(
    (sum, value) => sum + Number(value || 0),
    0,
  );
  const totalAssigned = Number(data?.summary?.totalAssigned ?? 0);
  const hasAssignedHistory = totalAssigned > 0;
  const avgCompletionTime = data?.summary?.avgCompletionTime;
  const workerRating = Number.isFinite(data?.worker?.rating)
    ? data.worker.rating.toFixed(1)
    : t("more.workerAnalyticsScreen.noValue");

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title={title} />
        <View className="flex-1 items-center justify-center">
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
      <BackButtonHeader title={title} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refetch()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View className="mb-5" style={{ gap: 12 }}>
          <View className="flex-row" style={{ gap: 12 }}>
            <SummaryTile
              label={t("more.workerAnalyticsScreen.summary.workerRatingLabel")}
              value={workerRating}
              hint={t("more.workerAnalyticsScreen.summary.workerRatingHint")}
              icon={Star}
              tone={colors.warning}
              colors={colors}
            />
            <SummaryTile
              label={t("more.workerAnalyticsScreen.summary.activeAssignedLabel")}
              value={totalAssigned}
              hint={t("more.workerAnalyticsScreen.summary.activeAssignedHint")}
              icon={Target}
              tone={colors.info}
              colors={colors}
            />
          </View>

          <MetricPanel
            label={t("more.workerAnalyticsScreen.metrics.avgCompletion")}
            value={
              hasAssignedHistory && typeof avgCompletionTime === "number"
                ? t("more.workerAnalyticsScreen.hoursValue", {
                    value: avgCompletionTime.toFixed(1),
                  })
                : t("more.workerAnalyticsScreen.noValue")
            }
            hint={t("more.workerAnalyticsScreen.metrics.avgCompletionHint")}
            icon={Clock3}
            tone={colors.warning}
            colors={colors}
          />
        </View>

        <View
          className="rounded-2xl p-5 mb-5"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center mb-3">
            <BarChart2
              size={18}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text
              className="text-base font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("more.workerAnalyticsScreen.weeklyTrend.title")}
            </Text>
          </View>
          <Text
            className="text-xs mb-4 leading-5"
            style={{ color: colors.textSecondary }}
          >
            {t("more.workerAnalyticsScreen.weeklyTrend.subtitle")}
          </Text>
          {data?.weeklyTrend?.length ? (
            <WeeklyStripChart data={data.weeklyTrend} colors={colors} />
          ) : (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {t("more.workerAnalyticsScreen.noData")}
            </Text>
          )}
        </View>

        <View
          className="rounded-2xl p-5 mb-5"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center mb-3">
            <ActivitySquare
              size={18}
              color={colors.warning}
              style={{ marginRight: 8 }}
            />
            <Text
              className="text-base font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("more.workerAnalyticsScreen.priority.title")}
            </Text>
          </View>
          <Text
            className="text-xs mb-4 leading-5"
            style={{ color: colors.textSecondary }}
          >
            {t("more.workerAnalyticsScreen.priority.subtitle")}
          </Text>
          <PriorityLane
            breakdown={data?.priorityBreakdown ?? {}}
            config={priorityConfig}
            colors={colors}
          />
        </View>

        <View
          className="rounded-2xl p-5"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center mb-3">
            <CheckCircle
              size={18}
              color={colors.success}
              style={{ marginRight: 8 }}
            />
            <Text
              className="text-base font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("more.workerAnalyticsScreen.status.title")}
            </Text>
          </View>
          <Text
            className="text-xs mb-4 leading-5"
            style={{ color: colors.textSecondary }}
          >
            {t("more.workerAnalyticsScreen.status.subtitle", {
              count: totalStatusCount,
            })}
          </Text>
          {statusConfig.map((status) => (
            <StatusMeter
              key={status.key}
              label={status.label}
              count={Number(data?.statusDistribution?.[status.key] || 0)}
              total={totalStatusCount}
              tone={status.color}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
