import { useLocalSearchParams } from "expo-router";
import {
  BarChart2,
  CheckCircle,
  Clock,
  Star,
  Target,
  TrendingUp,
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
import Card from "../../../components/Card";
import MetricCard from "../../../components/MetricCard";
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

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function WeeklyBarChart({ data, barColor, gridColor, labelColor }) {
  const CHART_PADDING = 32; // px on each side of the outer screen
  const CARD_PADDING = 16; // Card p-4 = 16
  const chartWidth = SCREEN_WIDTH - CHART_PADDING * 2 - CARD_PADDING * 2;
  const chartHeight = 140;
  const labelH = 24;
  const totalH = chartHeight + labelH;

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const n = data.length;
  const gap = 5;
  const barW = (chartWidth - gap * (n - 1)) / n;

  return (
    <Svg width={chartWidth} height={totalH}>
      {/* Horizontal grid lines at 25 / 50 / 75 / 100% */}
      {[0.25, 0.5, 0.75, 1].map((frac, i) => {
        const y = chartHeight - frac * chartHeight;
        return (
          <Line
            key={i}
            x1={0}
            y1={y}
            x2={chartWidth}
            y2={y}
            stroke={gridColor}
            strokeWidth={0.5}
          />
        );
      })}

      {/* Bars + labels */}
      {data.map((item, i) => {
        const x = i * (barW + gap);
        const barH = (item.count / maxVal) * (chartHeight - 12);
        const y = chartHeight - barH;

        return (
          <G key={i}>
            <Rect
              x={x}
              y={item.count > 0 ? y : chartHeight - 2}
              width={barW}
              height={item.count > 0 ? barH : 2}
              rx={3}
              fill={barColor}
              opacity={item.count === 0 ? 0.2 : 1}
            />
            {item.count > 0 && (
              <SvgText
                x={x + barW / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={9}
                fill={barColor}
                fontWeight="600"
              >
                {item.count}
              </SvgText>
            )}
            <SvgText
              x={x + barW / 2}
              y={totalH - 4}
              textAnchor="middle"
              fontSize={7.5}
              fill={labelColor}
            >
              {item.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Segmented priority bar ───────────────────────────────────────────────────
function PriorityBar({
  breakdown,
  priorityConfig,
  legendTextColor,
  emptyTrackColor,
}) {
  const total = priorityConfig.reduce(
    (sum, item) => sum + (breakdown[item.key] ?? 0),
    0,
  );

  return (
    <View>
      {total === 0 ? (
        <View
          className="h-5 rounded-full"
          style={{ backgroundColor: emptyTrackColor }}
        />
      ) : (
        <View className="flex-row rounded-full overflow-hidden h-5">
          {priorityConfig.map(({ key, color }) => {
            const pct = total > 0 ? (breakdown[key] ?? 0) / total : 0;
            if (pct === 0) return null;
            return (
              <View key={key} style={{ flex: pct, backgroundColor: color }} />
            );
          })}
        </View>
      )}

      {/* Legend */}
      <View className="flex-row mt-2 flex-wrap gap-3">
        {priorityConfig.map(({ key, label, color }) => (
          <View key={key} className="flex-row items-center mr-3">
            <View
              className="w-2.5 h-2.5 rounded-full mr-1.5"
              style={{ backgroundColor: color }}
            />
            <Text className="text-xs" style={{ color: legendTextColor }}>
              {label}: {breakdown[key] ?? 0}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatusRow({ label, count, total, color, textColor, trackColor }) {
  const pct = total > 0 ? count / total : 0;
  return (
    <View className="mb-3">
      <View className="flex-row justify-between mb-1">
        <View className="flex-row items-center">
          <View
            className="w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: color }}
          />
          <Text className="text-xs font-medium" style={{ color: textColor }}>
            {label}
          </Text>
        </View>
        <Text className="text-xs font-semibold" style={{ color: textColor }}>
          {count}
        </Text>
      </View>
      <View
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: trackColor }}
      >
        <View
          className="h-full rounded-full"
          style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
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

  const priorityConfig = useMemo(
    () => [
      {
        key: "Low",
        label: formatPriorityLabel(t, "Low"),
        color: getPriorityColor("Low", colors) ?? colors.textSecondary,
      },
      {
        key: "Medium",
        label: formatPriorityLabel(t, "Medium"),
        color: getPriorityColor("Medium", colors) ?? colors.textSecondary,
      },
      {
        key: "High",
        label: formatPriorityLabel(t, "High"),
        color: getPriorityColor("High", colors) ?? colors.textSecondary,
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

  useEffect(() => {
    if (!error) return null;
    Toast.show({
      type: "error",
      text1: t("more.workerAnalyticsScreen.failedTitle"),
      text2:
        error?.response?.data?.message ??
        t("more.workerAnalyticsScreen.failedMessage"),
    });
    return undefined;
  }, [error, t]);

  const title = workerId
    ? data?.worker?.fullName
      ? t("more.workerAnalyticsScreen.titleForWorker", {
          name: data.worker.fullName,
        })
      : t("more.workerAnalyticsScreen.titleWorker")
    : t("more.menu.workerAnalytics.title");

  const totalForStatus = data
    ? Object.values(data.statusDistribution ?? {}).reduce((a, b) => a + b, 0)
    : 0;

  const gridColor = colors.border;
  const labelColor = colors.textSecondary;
  const trackColor = colors.backgroundSecondary;

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader title={title} />
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
      <BackButtonHeader title={title} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refetch()}
            tintColor={colors.textSecondary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Worker Info Banner */}
        {data?.worker && (
          <Card style={{ marginBottom: 12 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text
                  className="text-base font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {data.worker.fullName}
                </Text>
                <Text
                  className="text-xs mt-0.5"
                  style={{ color: colors.textSecondary }}
                >
                  {t("more.workerAnalyticsScreen.departmentWithName", {
                    department: data.worker.department,
                  })}
                  {data.worker.specializations?.length > 0
                    ? `, ${data.worker.specializations.slice(0, 2).join(", ")}`
                    : ""}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Star size={14} color={colors.warning} />
                <Text
                  className="text-sm font-bold ml-1"
                  style={{ color: colors.textPrimary }}
                >
                  {Number.isFinite(data.worker.rating)
                    ? data.worker.rating.toFixed(1)
                    : t("more.workerAnalyticsScreen.noValue")}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Summary Metrics — 2×2 grid */}
        <View className="flex-row mb-2">
          <View className="flex-1 mr-1">
            <MetricCard
              colors={colors}
              Icon={Target}
              iconColor={colors.info}
              iconBgColor={colors.info + "22"}
              title={t("more.workerAnalyticsScreen.metrics.totalAssigned")}
              value={data?.summary?.totalAssigned ?? 0}
            />
          </View>
          <View className="flex-1 ml-1">
            <MetricCard
              colors={colors}
              Icon={CheckCircle}
              iconColor={colors.success}
              iconBgColor={colors.success + "22"}
              title={t("more.workerAnalyticsScreen.metrics.completed")}
              value={data?.summary?.totalCompleted ?? 0}
            />
          </View>
        </View>
        <View className="flex-row mb-4">
          <View className="flex-1 mr-1">
            <MetricCard
              colors={colors}
              Icon={TrendingUp}
              iconColor={colors.primary}
              iconBgColor={colors.primary + "22"}
              title={t("more.workerAnalyticsScreen.metrics.completionRate")}
              value={t("more.workerAnalyticsScreen.percentValue", {
                value: data?.summary?.completionRate ?? 0,
              })}
              valueColor={colors.primary}
            />
          </View>
          <View className="flex-1 ml-1">
            <MetricCard
              colors={colors}
              Icon={Clock}
              iconColor={colors.warning}
              iconBgColor={colors.warning + "22"}
              title={t("more.workerAnalyticsScreen.metrics.avgCompletion")}
              value={
                typeof data?.summary?.avgCompletionTime === "number"
                  ? t("more.workerAnalyticsScreen.hoursValue", {
                      value: data.summary.avgCompletionTime.toFixed(1),
                    })
                  : t("more.workerAnalyticsScreen.noValue")
              }
            />
          </View>
        </View>

        {/* Weekly Completion Trend */}
        <Card style={{ marginBottom: 12 }}>
          <View className="flex-row items-center mb-3">
            <BarChart2
              size={16}
              color={colors.info}
              style={{ marginRight: 6 }}
            />
            <Text
              className="text-sm font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("more.workerAnalyticsScreen.weeklyTrend.title")}
            </Text>
          </View>
          <Text
            className="text-xs mb-4"
            style={{ color: colors.textSecondary }}
          >
            {t("more.workerAnalyticsScreen.weeklyTrend.subtitle")}
          </Text>
          {data?.weeklyTrend?.length > 0 ? (
            <WeeklyBarChart
              data={data.weeklyTrend}
              barColor={colors.info}
              gridColor={gridColor}
              labelColor={labelColor}
            />
          ) : (
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {t("more.workerAnalyticsScreen.noData")}
            </Text>
          )}
        </Card>

        {/* Priority Breakdown */}
        <Card style={{ marginBottom: 12 }}>
          <View className="flex-row items-center mb-3">
            <Target
              size={16}
              color={colors.warning}
              style={{ marginRight: 6 }}
            />
            <Text
              className="text-sm font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("more.workerAnalyticsScreen.priority.title")}
            </Text>
          </View>
          <Text
            className="text-xs mb-3"
            style={{ color: colors.textSecondary }}
          >
            {t("more.workerAnalyticsScreen.priority.subtitle")}
          </Text>
          <PriorityBar
            breakdown={data?.priorityBreakdown ?? {}}
            priorityConfig={priorityConfig}
            legendTextColor={colors.textSecondary}
            emptyTrackColor={colors.border}
          />
        </Card>

        {/* Status Distribution */}
        <Card style={{ marginBottom: 4 }}>
          <View className="flex-row items-center mb-3">
            <CheckCircle
              size={16}
              color={colors.success}
              style={{ marginRight: 6 }}
            />
            <Text
              className="text-sm font-bold"
              style={{ color: colors.textPrimary }}
            >
              {t("more.workerAnalyticsScreen.status.title")}
            </Text>
          </View>
          <Text
            className="text-xs mb-4"
            style={{ color: colors.textSecondary }}
          >
            {t("more.workerAnalyticsScreen.status.subtitle", {
              count: totalForStatus,
            })}
          </Text>
          {statusConfig.map(({ key, label, color }) => {
            const count = data?.statusDistribution?.[key] ?? 0;
            return (
              <StatusRow
                key={key}
                label={label}
                count={count}
                total={totalForStatus}
                color={color}
                textColor={colors.textPrimary}
                trackColor={trackColor}
              />
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
