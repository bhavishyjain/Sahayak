import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivitySquare,
  CheckCircle,
  CheckSquare,
  ChevronRight,
  Layers,
  SlidersHorizontal,
  Square,
  Tag,
  WandSparkles,
  X,
  Zap,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useAiReviewActions } from "../../../utils/hooks/useAiReviewActions";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import { AI_REVIEW_URL } from "../../../url";

const getSentimentConfig = (colors) => ({
  calm: { labelKey: "hod.aiReview.sentiments.calm", color: colors.success },
  frustrated: {
    labelKey: "hod.aiReview.sentiments.frustrated",
    color: colors.warning,
  },
  angry: { labelKey: "hod.aiReview.sentiments.angry", color: colors.danger },
  desperate: {
    labelKey: "hod.aiReview.sentiments.desperate",
    color: colors.danger,
  },
  unknown: {
    labelKey: "hod.aiReview.sentiments.unknown",
    color: colors.textSecondary,
  },
});

const normalizeTicketId = (value, fallback) => {
  const compact = String(value ?? "")
    .replace(/\s+/g, "")
    .trim();

  if (!compact) return fallback;

  const cleaned = compact.replace(/[^A-Za-z0-9#_-]/g, "");
  if (cleaned.length < 4 || cleaned.length > 24) return fallback;

  return cleaned.toUpperCase();
};

const normalizeText = (value, fallback = "") => {
  const raw = String(value ?? "")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[\u2500-\u257F\u2580-\u259F]/g, " ");

  const flattened = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  const cleaned = flattened
    .replace(/[-_=~•·|]{3,}/g, " ")
    .replace(/[.]{4,}/g, " ")
    .replace(/[\u2010-\u2015]{4,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || fallback;
};

const isMostlyLineArt = (value) => {
  const compact = String(value ?? "").replace(/\s+/g, "");
  if (!compact) return true;

  const alphaNum = (compact.match(/[A-Za-z0-9]/g) || []).length;
  const symbolRatio = (compact.length - alphaNum) / compact.length;

  return compact.length > 80 && alphaNum < 8 && symbolRatio > 0.85;
};

const isVisualNoiseOnly = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return true;

  const alnumCount = (text.match(/[A-Za-z0-9]/g) || []).length;
  const symbolCount = text.length - alnumCount;
  return text.length > 40 && symbolCount / text.length > 0.85;
};

const pickDisplayDescription = (item, fallback) => {
  const candidates = [
    item?.description,
    item?.refinedText,
    item?.rawText,
    item?.title,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isMostlyLineArt(candidate)) continue;

    const normalized = normalizeText(candidate, "");
    if (normalized) return normalized;
  }

  return fallback;
};

const normalizeComparisonValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const hasChangedValue = (currentValue, suggestedValue) => {
  if (suggestedValue == null || String(suggestedValue).trim() === "") {
    return false;
  }

  return (
    normalizeComparisonValue(currentValue) !==
    normalizeComparisonValue(suggestedValue)
  );
};

function StatPanel({ label, value, hint, accent, colors }) {
  return (
    <View
      className="flex-1 rounded-2xl p-4"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        className="text-xs font-semibold"
        style={{ color: colors.textSecondary }}
      >
        {label}
      </Text>
      <Text className="text-2xl font-bold mt-1" style={{ color: accent }}>
        {value}
      </Text>
      <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
        {hint}
      </Text>
    </View>
  );
}

function ConfidencePill({ confidence, colors, t }) {
  const pct = Math.round(Number(confidence || 0) * 100);
  const tone =
    pct >= 90 ? colors.success : pct >= 75 ? colors.warning : colors.danger;

  return (
    <View
      className="px-3 py-1 rounded-full"
      style={{ backgroundColor: tone + "1F" }}
    >
      <Text className="text-xs font-semibold" style={{ color: tone }}>
        {t("hod.aiReview.confidence", { pct })}
      </Text>
    </View>
  );
}

function SentimentPill({ sentiment, colors, t }) {
  const configMap = getSentimentConfig(colors);
  const normalized = String(sentiment || "unknown").toLowerCase();
  const config = configMap[normalized] ?? configMap.unknown;

  return (
    <View
      className="px-2.5 py-1 rounded-full"
      style={{ backgroundColor: config.color + "18" }}
    >
      <Text
        className="text-[11px] font-semibold"
        style={{ color: config.color }}
      >
        {t(config.labelKey)}
      </Text>
    </View>
  );
}

function SuggestionChip({ label, current, suggested, tone, colors }) {
  return (
    <View
      className="rounded-xl px-3 py-2 mr-2 mb-2"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        className="text-[10px] font-semibold"
        style={{ color: colors.textSecondary }}
      >
        {label}
      </Text>
      <View className="flex-row items-center mt-1">
        <Text
          className="text-xs font-semibold"
          style={{ color: colors.textSecondary }}
        >
          {current}
        </Text>
        <ChevronRight
          size={11}
          color={colors.textSecondary}
          style={{ marginHorizontal: 4 }}
        />
        <Text className="text-xs font-bold" style={{ color: tone }}>
          {suggested}
        </Text>
      </View>
    </View>
  );
}

function ActionPill({
  label,
  icon: Icon,
  tone,
  onPress,
  disabled = false,
  colors,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center px-3 py-2 rounded-xl mr-2 mb-2"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={14} color={tone} />
      <Text className="text-xs font-semibold ml-1.5" style={{ color: tone }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function QueueCard({
  item,
  selectMode,
  isSelected,
  isApplying,
  colors,
  t,
  onToggleSelect,
  onOpenComplaint,
  onApplyDepartment,
  onApplyPriority,
  onApplyBoth,
}) {
  const ai = item.aiSuggestion ?? {};
  const current = item.currentValues ?? {};
  const suggestedDepartment =
    ai.department ?? item.aiSuggestedDepartment ?? item.aiAnalysis?.department;
  const suggestedPriority =
    ai.priority ??
    item.aiAnalysis?.suggestedPriority ??
    item.aiSuggestion?.suggestedPriority;
  const departmentChanged = hasChangedValue(
    current.department,
    suggestedDepartment,
  );
  const priorityChanged = hasChangedValue(current.priority, suggestedPriority);
  const complaintText =
    item.description ??
    item.refinedText ??
    item.rawText ??
    t("hod.aiReview.notAvailable");
  const sentiment = ai.sentiment;
  const confidenceValue = item.aiConfidence ?? Number(ai.confidence ?? 0) / 100;

  return (
    <TouchableOpacity
      activeOpacity={selectMode ? 0.75 : 1}
      onPress={() =>
        selectMode ? onToggleSelect(item._id) : onOpenComplaint(item)
      }
      onLongPress={() => onToggleSelect(item._id)}
      disabled={isApplying}
      className="mb-4"
    >
      <View
        className="rounded-3xl p-5"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? colors.primary : colors.border,
        }}
      >
        <View className="flex-row items-start justify-between mb-4">
          <View className="flex-1 pr-3">
            <View className="flex-row items-center mb-2">
              {selectMode ? (
                <View className="mr-2">
                  {isSelected ? (
                    <CheckSquare size={18} color={colors.primary} />
                  ) : (
                    <Square size={18} color={colors.textSecondary} />
                  )}
                </View>
              ) : null}
              <Text
                className="text-[11px] font-mono"
                style={{ color: colors.textSecondary }}
              >
                {item.ticketId}
              </Text>
            </View>
            <Text
              className="text-base font-semibold leading-6"
              style={{ color: colors.textPrimary }}
              numberOfLines={3}
            >
              {complaintText}
            </Text>
          </View>
          <ConfidencePill confidence={confidenceValue} colors={colors} t={t} />
        </View>

        <View className="flex-row flex-wrap items-center mb-3">
          <SentimentPill sentiment={sentiment} colors={colors} t={t} />
          {ai.urgency != null ? (
            <View className="flex-row items-center ml-2 mb-2">
              <Zap size={12} color={colors.warning} />
              <Text
                className="text-xs ml-1"
                style={{ color: colors.textSecondary }}
              >
                {t("hod.aiReview.urgency", { value: ai.urgency })}
              </Text>
            </View>
          ) : null}
          {ai.affectedCount != null ? (
            <Text
              className="text-xs ml-2 mb-2"
              style={{ color: colors.textSecondary }}
            >
              {t("hod.aiReview.affected", { count: ai.affectedCount })}
            </Text>
          ) : null}
        </View>

        <Text
          className="text-xs font-semibold mb-2"
          style={{ color: colors.textSecondary }}
        >
          {t("hod.aiReview.suggestionsTitle")}
        </Text>
        <View className="flex-row flex-wrap mb-3">
          {departmentChanged ? (
            <SuggestionChip
              label={t("hod.aiReview.labels.department")}
              current={current.department ?? t("hod.aiReview.notAvailable")}
              suggested={suggestedDepartment ?? t("hod.aiReview.notAvailable")}
              tone={colors.info}
              colors={colors}
            />
          ) : null}
          {priorityChanged ? (
            <SuggestionChip
              label={t("hod.aiReview.labels.priority")}
              current={current.priority ?? t("hod.aiReview.notAvailable")}
              suggested={suggestedPriority ?? t("hod.aiReview.notAvailable")}
              tone={colors.warning}
              colors={colors}
            />
          ) : null}
          {!departmentChanged && !priorityChanged ? (
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {t("hod.aiReview.priorityOnly")}
            </Text>
          ) : null}
        </View>

        {ai.reasoning ? (
          <View
            className="rounded-2xl px-4 py-3 mb-4"
            style={{ backgroundColor: colors.backgroundPrimary }}
          >
            <Text
              className="text-xs leading-5"
              style={{ color: colors.textSecondary }}
            >
              {ai.reasoning}
            </Text>
          </View>
        ) : null}

        {!selectMode ? (
          <View className="flex-row flex-wrap">
            {departmentChanged ? (
              <ActionPill
                label={t("hod.aiReview.actions.applyDepartment")}
                icon={Layers}
                tone={colors.info}
                onPress={onApplyDepartment}
                disabled={isApplying}
                colors={colors}
              />
            ) : null}
            {priorityChanged ? (
              <ActionPill
                label={t("hod.aiReview.actions.applyPriority")}
                icon={Tag}
                tone={colors.warning}
                onPress={onApplyPriority}
                disabled={isApplying}
                colors={colors}
              />
            ) : null}
            {departmentChanged && priorityChanged ? (
              <ActionPill
                label={t("hod.aiReview.actions.applyBoth")}
                icon={CheckCircle}
                tone={colors.primary}
                onPress={onApplyBoth}
                disabled={isApplying}
                colors={colors}
              />
            ) : null}
            {isApplying ? (
              <View className="py-2 pl-2">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function AiReview() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();
  const { applySuggestion } = useAiReviewActions(t);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [reviewCounts, setReviewCounts] = useState({
    departmentShiftCount: 0,
    priorityShiftCount: 0,
  });
  const [reviewType, setReviewType] = useState("all");
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [applying, setApplying] = useState(new Set());

  const load = async ({
    isRefresh = false,
    page = 1,
    append = false,
    showLoader = true,
  } = {}) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (append) {
        setLoadingMore(true);
      } else if (showLoader) {
        setLoading(true);
      }

      const res = await apiCall({
        method: "GET",
        url: AI_REVIEW_URL,
        params: {
          type: reviewType,
          page,
          limit: pagination.limit,
        },
      });
      setReviewCounts({
        departmentShiftCount: Number(res?.data?.departmentShiftCount ?? 0),
        priorityShiftCount: Number(res?.data?.priorityShiftCount ?? 0),
      });
      setPagination((prev) => ({
        ...prev,
        page: Number(res?.data?.pagination?.page ?? page),
        limit: Number(res?.data?.pagination?.limit ?? prev.limit),
        total: Number(res?.data?.pagination?.total ?? 0),
        totalPages: Number(res?.data?.pagination?.totalPages ?? 1),
        hasNextPage: Boolean(res?.data?.pagination?.hasNextPage),
        hasPrevPage: Boolean(res?.data?.pagination?.hasPrevPage),
      }));
      const normalizedComplaints = (res?.data?.complaints ?? [])
        .map((item) => {
          const id = item?._id ?? item?.id;
          if (!id) return null;

          const fallbackText = t("hod.aiReview.notAvailable");
          const description = pickDisplayDescription(item, fallbackText);
          const ticketId = normalizeTicketId(item?.ticketId, fallbackText);
          const looksCorrupt =
            isMostlyLineArt(item?.description) &&
            isMostlyLineArt(item?.refinedText) &&
            isMostlyLineArt(item?.rawText);

          if (
            (!description || description === fallbackText || looksCorrupt) &&
            !item?.aiSuggestion?.department &&
            !item?.aiSuggestion?.priority
          ) {
            return null;
          }

          return {
            ...item,
            _id: id,
            ticketId,
            description,
            aiSuggestion: {
              ...item?.aiSuggestion,
              reasoning: (() => {
                const reasoning = normalizeText(
                  item?.aiSuggestion?.reasoning,
                  "",
                );
                return isVisualNoiseOnly(reasoning) ? "" : reasoning;
              })(),
            },
          };
        })
        .filter(Boolean);

      setComplaints((prev) =>
        append
          ? [
              ...prev,
              ...normalizedComplaints.filter(
                (item) =>
                  !prev.some(
                    (existing) => String(existing._id) === String(item._id),
                  ),
              ),
            ]
          : normalizedComplaints,
      );
    } catch (e) {
      setReviewCounts({
        departmentShiftCount: 0,
        priorityShiftCount: 0,
      });
      if (!append) {
        setPagination((prev) => ({
          ...prev,
          page: 1,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        }));
      }
      Toast.show({
        type: "error",
        text1: t("hod.aiReview.toasts.loadFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("hod.aiReview.toasts.loadFailedMessage"),
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load({ page: 1 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pagination.limit, reviewType, t]),
  );

  const applyOne = async (
    complaintId,
    applyDepartment,
    applyPriority,
    showSuccessToast = true,
    refreshAfter = true,
  ) => {
    setApplying((prev) => new Set(prev).add(complaintId));
    try {
      await applySuggestion({
        complaintId,
        applyDepartment,
        applyPriority,
        silentSuccess: !showSuccessToast,
      });
      if (refreshAfter) {
        await load({ page: 1, showLoader: false });
      }
      return true;
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.aiReview.toasts.applyFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("hod.aiReview.toasts.applyFailedMessage"),
      });
      return false;
    } finally {
      setApplying((prev) => {
        const next = new Set(prev);
        next.delete(complaintId);
        return next;
      });
    }
  };

  const applyBulk = async (applyDepartment, applyPriority) => {
    setBulkModalVisible(false);
    const ids = [...selected];
    if (!ids.length) return;

    let successCount = 0;
    for (const complaintId of ids) {
      const wasSuccessful = await applyOne(
        complaintId,
        applyDepartment,
        applyPriority,
        false,
        false,
      );
      if (wasSuccessful) successCount += 1;
    }

    await load({ page: 1, showLoader: false });
    setSelected(new Set());
    setSelectMode(false);
    Toast.show({
      type: "success",
      text1: t("hod.aiReview.toasts.bulkApplied", {
        count: successCount,
        plural: successCount !== 1 ? "s" : "",
      }),
    });
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const openComplaint = (item) => {
    const complaintId = item?._id ?? item?.id;
    if (!complaintId) return;

    router.push({
      pathname: "/(app)/complaints/complaint-details",
      params: { id: complaintId },
    });
  };
  const departmentShiftCount = complaints.filter((item) => {
    const currentDepartment = item.currentValues?.department;
    const suggestedDepartment =
      item.aiSuggestion?.department ??
      item.aiSuggestedDepartment ??
      item.aiAnalysis?.department;
    return hasChangedValue(currentDepartment, suggestedDepartment);
  }).length;
  const priorityShiftCount = complaints.filter((item) => {
    const currentPriority = item.currentValues?.priority;
    const suggestedPriority =
      item.aiSuggestion?.priority ?? item.aiAnalysis?.suggestedPriority;
    return hasChangedValue(currentPriority, suggestedPriority);
  }).length;
  const displayedDepartmentShiftCount = Math.max(
    departmentShiftCount,
    Number(reviewCounts.departmentShiftCount || 0),
  );
  const displayedPriorityShiftCount = Math.max(
    priorityShiftCount,
    Number(reviewCounts.priorityShiftCount || 0),
  );
  const queueCount = Number(pagination.total || 0);
  const reviewTypeOptions = [
    { key: "all", label: "All" },
    { key: "department", label: "Dept" },
    { key: "priority", label: "Priority" },
    { key: "both", label: "Both" },
  ];
  const queueSubtitleByType = {
    all: "All AI-suggested changes",
    department: "Department-only changes",
    priority: "Priority-only changes",
    both: "Department and priority changes",
  };
  const handleLoadMore = () => {
    if (loading || refreshing || loadingMore || !pagination.hasNextPage) {
      return;
    }

    load({
      page: pagination.page + 1,
      append: true,
      showLoader: false,
    });
  };

  const listHeader = (
    <View className="px-4 pt-4 pb-2">
      <View className="mb-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            <Text
              className="text-xs font-semibold uppercase"
              style={{ color: colors.textSecondary }}
            >
              AI review queue
            </Text>
            <Text
              className="text-3xl font-bold mt-1"
              style={{ color: colors.textPrimary }}
            >
              {queueCount}
            </Text>
            <Text
              className="text-sm mt-2"
              style={{ color: colors.textSecondary }}
            >
              {queueSubtitleByType[reviewType]}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row mb-4" style={{ gap: 10 }}>
        <StatPanel
          label="Department shifts"
          value={displayedDepartmentShiftCount}
          hint="Routing changes"
          accent={colors.info}
          colors={colors}
        />
        <StatPanel
          label="Priority shifts"
          value={displayedPriorityShiftCount}
          hint="Urgency changes"
          accent={colors.warning}
          colors={colors}
        />
      </View>

      {complaints.length > 0 ? (
        <>
          <View className="flex-row flex-wrap mb-4" style={{ gap: 8 }}>
            {reviewTypeOptions.map((option) => {
              const isActive = reviewType === option.key;
              return (
                <PressableBlock
                  key={option.key}
                  onPress={() => {
                    setSelected(new Set());
                    setSelectMode(false);
                    setReviewType(option.key);
                  }}
                  className="px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: isActive
                      ? colors.primary + "18"
                      : colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                  }}
                >
                  <View className="flex-row items-center">
                    {option.key === "all" ? (
                      <SlidersHorizontal
                        size={14}
                        color={isActive ? colors.primary : colors.textSecondary}
                      />
                    ) : null}
                    <Text
                      className={`text-xs font-semibold${option.key === "all" ? " ml-1.5" : ""}`}
                      style={{
                        color: isActive ? colors.primary : colors.textPrimary,
                      }}
                    >
                      {option.label}
                    </Text>
                  </View>
                </PressableBlock>
              );
            })}
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text
                className="text-base font-bold"
                style={{ color: colors.textPrimary }}
              >
                Review Queue
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors.textSecondary }}
              >
                {selectMode
                  ? t("hod.aiReview.bulk.selectedCount", {
                      count: selected.size,
                    })
                  : `${queueCount} items waiting`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (selectMode) {
                  setSelectMode(false);
                  setSelected(new Set());
                } else {
                  setSelectMode(true);
                }
              }}
              className="px-4 py-2 rounded-full"
              style={{
                backgroundColor: selectMode
                  ? colors.backgroundSecondary
                  : colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: selectMode ? colors.border : colors.border,
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{
                  color: selectMode ? colors.textSecondary : colors.textPrimary,
                }}
              >
                {selectMode
                  ? t("hod.aiReview.actions.cancel")
                  : t("hod.aiReview.actions.select")}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={t("hod.aiReview.title")}
        onBack={() => router.back()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            {t("hod.aiReview.loading")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(item, index) => String(item?._id ?? item?.id ?? index)}
          renderItem={({ item }) => (
            <View className="px-4">
              <QueueCard
                item={item}
                selectMode={selectMode}
                isSelected={selected.has(item._id)}
                isApplying={applying.has(item._id)}
                colors={colors}
                t={t}
                onToggleSelect={toggleSelect}
                onOpenComplaint={openComplaint}
                onApplyDepartment={() => applyOne(item._id, true, false)}
                onApplyPriority={() => applyOne(item._id, false, true)}
                onApplyBoth={() => applyOne(item._id, true, true)}
              />
            </View>
          )}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingBottom: 130 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load({ isRefresh: true, page: 1 })}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={
            <View className="px-4">
              <View
                className="rounded-3xl p-8 items-center"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  className="w-18 h-18 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: colors.success + "18" }}
                >
                  <CheckCircle size={32} color={colors.success} />
                </View>
                <Text
                  className="text-lg font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  {t("hod.aiReview.empty.title")}
                </Text>
                <Text
                  className="text-sm mt-2 text-center leading-6"
                  style={{ color: colors.textSecondary }}
                >
                  {t("hod.aiReview.empty.description")}
                </Text>
              </View>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View className="px-4 pt-2 pb-4 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  className="text-xs mt-2"
                  style={{ color: colors.textSecondary }}
                >
                  Loading more...
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {selectMode && selected.size > 0 ? (
        <View
          className="absolute left-4 right-4 bottom-6 rounded-3xl p-4"
          style={{
            backgroundColor: colors.backgroundSecondary,
            shadowColor: colors.dark,
            shadowOpacity: 0.14,
            shadowRadius: 10,
            elevation: 6,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text
                className="text-sm font-bold"
                style={{ color: colors.textPrimary }}
              >
                {t("hod.aiReview.bulk.selectedCount", { count: selected.size })}
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors.textSecondary }}
              >
                Bulk-apply the same AI decision across the selected queue items.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setBulkModalVisible(true)}
              className="px-4 py-3 rounded-2xl flex-row items-center"
              style={{ backgroundColor: colors.primary }}
            >
              <ActivitySquare size={16} color={colors.light} />
              <Text
                className="text-xs font-bold ml-1.5"
                style={{ color: colors.light }}
              >
                {t("hod.aiReview.bulk.applyCta")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Modal
        visible={bulkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBulkModalVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.dark + "80" }}
          onPress={() => setBulkModalVisible(false)}
        >
          <Pressable
            className="rounded-t-[34px] p-6"
            style={{ backgroundColor: colors.backgroundPrimary }}
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 pr-3">
                <Text
                  className="text-lg font-bold"
                  style={{ color: colors.textPrimary }}
                >
                  {t("hod.aiReview.bulk.modalTitle", {
                    count: selected.size,
                    plural: selected.size !== 1 ? "s" : "",
                  })}
                </Text>
                <Text
                  className="text-sm mt-2"
                  style={{ color: colors.textSecondary }}
                >
                  {t("hod.aiReview.bulk.modalHint")}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setBulkModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {[
              {
                key: "department",
                icon: Layers,
                tone: colors.info,
                title: t("hod.aiReview.bulk.options.departmentOnly.label"),
                subtitle: t("hod.aiReview.bulk.options.departmentOnly.sub"),
                onPress: () => applyBulk(true, false),
              },
              {
                key: "priority",
                icon: Tag,
                tone: colors.warning,
                title: t("hod.aiReview.bulk.options.priorityOnly.label"),
                subtitle: t("hod.aiReview.bulk.options.priorityOnly.sub"),
                onPress: () => applyBulk(false, true),
              },
              {
                key: "both",
                icon: CheckCircle,
                tone: colors.primary,
                title: t(
                  "hod.aiReview.bulk.options.departmentAndPriority.label",
                ),
                subtitle: t(
                  "hod.aiReview.bulk.options.departmentAndPriority.sub",
                ),
                onPress: () => applyBulk(true, true),
              },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                onPress={option.onPress}
                className="flex-row items-center rounded-2xl p-4 mb-3"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  className="w-12 h-12 rounded-2xl items-center justify-center mr-3"
                  style={{ backgroundColor: option.tone + "16" }}
                >
                  <option.icon size={20} color={option.tone} />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {option.title}
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {option.subtitle}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
