import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  BarChart2,
  CheckCircle,
  Clock,
  Star,
  Target,
  TrendingUp,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Svg, {
  G,
  Line,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import MetricCard from "../../../components/MetricCard";
import { useTheme } from "../../../utils/context/theme";
import apiCall from "../../../utils/api";
import { WORKER_ANALYTICS_URL } from "../../../url";

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
const PRIORITY_CFG = [
  { key: "Low", label: "Low", color: "#10B981" },
  { key: "Medium", label: "Med", color: "#F59E0B" },
  { key: "High", label: "High", color: "#EF4444" },
];

function PriorityBar({ breakdown }) {
  const total =
    (breakdown.Low || 0) + (breakdown.Medium || 0) + (breakdown.High || 0);

  return (
    <View>
      {total === 0 ? (
        <View
          className="h-5 rounded-full"
          style={{ backgroundColor: "#E5E7EB" }}
        />
      ) : (
        <View className="flex-row rounded-full overflow-hidden h-5">
          {PRIORITY_CFG.map(({ key, color }) => {
            const pct = total > 0 ? (breakdown[key] || 0) / total : 0;
            if (pct === 0) return null;
            return (
              <View
                key={key}
                style={{ flex: pct, backgroundColor: color }}
              />
            );
          })}
        </View>
      )}

      {/* Legend */}
      <View className="flex-row mt-2 flex-wrap gap-3">
        {PRIORITY_CFG.map(({ key, label, color }) => (
          <View key={key} className="flex-row items-center mr-3">
            <View
              className="w-2.5 h-2.5 rounded-full mr-1.5"
              style={{ backgroundColor: color }}
            />
            <Text className="text-xs" style={{ color: "#6B7280" }}>
              {label}: {breakdown[key] || 0}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Status distribution rows ─────────────────────────────────────────────────
const STATUS_CFG = [
  { key: "resolved", label: "Resolved", color: "#10B981" },
  { key: "in-progress", label: "In Progress", color: "#3B82F6" },
  { key: "assigned", label: "Assigned", color: "#8B5CF6" },
  { key: "pending-approval", label: "Pending Approval", color: "#F59E0B" },
  { key: "needs-rework", label: "Needs Rework", color: "#EF4444" },
  { key: "pending", label: "Pending", color: "#6B7280" },
  { key: "cancelled", label: "Cancelled", color: "#9CA3AF" },
];

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
  const { colorScheme } = useTheme();
  const { workerId } = useLocalSearchParams();

  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const url = workerId
          ? `${WORKER_ANALYTICS_URL}?workerId=${workerId}`
          : WORKER_ANALYTICS_URL;

        const res = await apiCall({ method: "GET", url });
        if (res?.data) setData(res.data);
      } catch (e) {
        Toast.show({
          type: "error",
          text1: "Failed to load analytics",
          text2: e?.response?.data?.message || "Please try again",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [workerId],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  const title = workerId
    ? data?.worker?.fullName
      ? `${data.worker.fullName}'s Analytics`
      : "Worker Analytics"
    : "My Analytics";

  const totalForStatus = data
    ? Object.values(data.statusDistribution || {}).reduce((a, b) => a + b, 0)
    : 0;

  const gridColor = colorScheme === "dark" ? "#374151" : "#E5E7EB";
  const labelColor = colorScheme === "dark" ? "#9CA3AF" : "#6B7280";
  const trackColor = colorScheme === "dark" ? "#374151" : "#F3F4F6";

  if (loading) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
        <BackButtonHeader title={title} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
      <BackButtonHeader title={title} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.textSecondary}
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
                  {data.worker.department} Department
                  {data.worker.specializations?.length > 0
                    ? ` · ${data.worker.specializations.slice(0, 2).join(", ")}`
                    : ""}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Star size={14} color="#F59E0B" />
                <Text
                  className="text-sm font-bold ml-1"
                  style={{ color: colors.textPrimary }}
                >
                  {(data.worker.rating || 4.5).toFixed(1)}
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
              iconColor="#3B82F6"
              iconBgColor="#3B82F622"
              title="Total Assigned"
              value={data?.summary?.totalAssigned ?? 0}
            />
          </View>
          <View className="flex-1 ml-1">
            <MetricCard
              colors={colors}
              Icon={CheckCircle}
              iconColor="#10B981"
              iconBgColor="#10B98122"
              title="Completed"
              value={data?.summary?.totalCompleted ?? 0}
            />
          </View>
        </View>
        <View className="flex-row mb-4">
          <View className="flex-1 mr-1">
            <MetricCard
              colors={colors}
              Icon={TrendingUp}
              iconColor="#8B5CF6"
              iconBgColor="#8B5CF622"
              title="Completion Rate"
              value={`${data?.summary?.completionRate ?? 0}%`}
              valueColor="#8B5CF6"
            />
          </View>
          <View className="flex-1 ml-1">
            <MetricCard
              colors={colors}
              Icon={Clock}
              iconColor="#F59E0B"
              iconBgColor="#F59E0B22"
              title="Avg Completion"
              value={
                data?.summary?.avgCompletionTime
                  ? `${data.summary.avgCompletionTime.toFixed(1)}h`
                  : "—"
              }
            />
          </View>
        </View>

        {/* Weekly Completion Trend */}
        <Card style={{ marginBottom: 12 }}>
          <View className="flex-row items-center mb-3">
            <BarChart2 size={16} color="#3B82F6" style={{ marginRight: 6 }} />
            <Text
              className="text-sm font-bold"
              style={{ color: colors.textPrimary }}
            >
              Weekly Completion Trend
            </Text>
          </View>
          <Text
            className="text-xs mb-4"
            style={{ color: colors.textSecondary }}
          >
            Resolved complaints per week (last 8 weeks)
          </Text>
          {data?.weeklyTrend?.length > 0 ? (
            <WeeklyBarChart
              data={data.weeklyTrend}
              barColor="#3B82F6"
              gridColor={gridColor}
              labelColor={labelColor}
            />
          ) : (
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              No data available
            </Text>
          )}
        </Card>

        {/* Priority Breakdown */}
        <Card style={{ marginBottom: 12 }}>
          <View className="flex-row items-center mb-3">
            <Target size={16} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text
              className="text-sm font-bold"
              style={{ color: colors.textPrimary }}
            >
              Priority Distribution
            </Text>
          </View>
          <Text
            className="text-xs mb-3"
            style={{ color: colors.textSecondary }}
          >
            All assigned complaints by priority
          </Text>
          <PriorityBar breakdown={data?.priorityBreakdown || {}} />
        </Card>

        {/* Status Distribution */}
        <Card style={{ marginBottom: 4 }}>
          <View className="flex-row items-center mb-3">
            <CheckCircle size={16} color="#10B981" style={{ marginRight: 6 }} />
            <Text
              className="text-sm font-bold"
              style={{ color: colors.textPrimary }}
            >
              Status Overview
            </Text>
          </View>
          <Text
            className="text-xs mb-4"
            style={{ color: colors.textSecondary }}
          >
            Distribution across all {totalForStatus} tasks
          </Text>
          {STATUS_CFG.map(({ key, label, color }) => {
            const count = data?.statusDistribution?.[key] || 0;
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
