import { useRouter } from "expo-router";
import {
  CheckCircle,
  ChevronRight,
  Layers,
  Tag,
  Zap,
  CheckSquare,
  Square,
  X,
} from "lucide-react-native";
import { useState, useCallback } from "react";
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
import Card from "../../../components/Card";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import { AI_REVIEW_URL, APPLY_AI_SUGGESTION_URL } from "../../../url";
import { useFocusEffect } from "expo-router";

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
    .replace(/[\u0000-\u001F\u007F]/g, " ");

  const flattened = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  const cleaned = flattened
    .replace(/[-_=~•·|]{3,}/g, " ")
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

function ConfidenceBadge({ value, colors, t }) {
  const confidence = Number(value ?? 0);
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 90 ? colors.success : pct >= 75 ? colors.warning : colors.danger;
  return (
    <View
      className="px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + "22" }}
    >
      <Text className="text-xs font-semibold" style={{ color }}>
        {t("hod.aiReview.confidence", { pct })}
      </Text>
    </View>
  );
}

function SentimentBadge({ sentiment, colors, t }) {
  const sentimentConfig = getSentimentConfig(colors);
  const normalizedSentiment = String(sentiment || "unknown").toLowerCase();
  const cfg = sentimentConfig[normalizedSentiment] ?? sentimentConfig.unknown;
  return (
    <View
      className="px-2 py-0.5 rounded-full ml-2"
      style={{ backgroundColor: cfg.color + "22" }}
    >
      <Text className="text-xs font-semibold" style={{ color: cfg.color }}>
        {t(cfg.labelKey)}
      </Text>
    </View>
  );
}

function DiffRow({ label, current, suggested, colors }) {
  const hasDiff = current !== suggested;
  return (
    <View className="flex-row items-center mt-1">
      <Text className="text-xs w-20" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      <Text
        className="text-xs font-semibold"
        style={{ color: hasDiff ? colors.textSecondary : colors.textPrimary }}
      >
        {current}
      </Text>
      {hasDiff && (
        <>
          <ChevronRight size={12} color={colors.textSecondary} />
          <Text className="text-xs font-bold" style={{ color: colors.info }}>
            {suggested}
          </Text>
        </>
      )}
    </View>
  );
}

export default function AiReview() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [applying, setApplying] = useState(new Set()); // ids currently being patched

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await apiCall({ method: "GET", url: AI_REVIEW_URL });
      const normalizedComplaints = (res?.data?.complaints ?? [])
        .map((item) => {
          const id = item?._id ?? item?.id;
          if (!id) return null;

          const fallbackText = t("hod.aiReview.notAvailable");
          const description = pickDisplayDescription(item, fallbackText);
          const normalizedTicketId = normalizeTicketId(
            item?.ticketId,
            fallbackText,
          );
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
            ticketId: normalizedTicketId,
            description,
            aiSuggestion: {
              ...item?.aiSuggestion,
              reasoning: normalizeText(item?.aiSuggestion?.reasoning, ""),
            },
          };
        })
        .filter(Boolean);

      setComplaints(normalizedComplaints);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("hod.aiReview.toasts.loadFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("hod.aiReview.toasts.loadFailedMessage"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [t]),
  );

  const applyOne = async (
    complaintId,
    applyDepartment,
    applyPriority,
    showSuccessToast = true,
  ) => {
    setApplying((prev) => new Set(prev).add(complaintId));
    try {
      await apiCall({
        method: "POST",
        url: APPLY_AI_SUGGESTION_URL(complaintId),
        data: { applyDepartment, applyPriority },
      });
      if (showSuccessToast) {
        Toast.show({
          type: "success",
          text1: t("hod.aiReview.toasts.applySuccessTitle"),
        });
      }
      setComplaints((prev) => prev.filter((c) => c._id !== complaintId));
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
    if (ids.length === 0) return;

    let successCount = 0;
    for (const id of ids) {
      const wasSuccessful = await applyOne(
        id,
        applyDepartment,
        applyPriority,
        false,
      );
      if (wasSuccessful) {
        successCount++;
      }
    }
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

  const renderItem = ({ item }) => {
    if (!item?._id) return null;

    const c = item;
    const ai = c.aiSuggestion ?? {};
    const cur = c.currentValues ?? {};
    const deptDiff = ai.department != null && ai.department !== cur.department;
    const priorityDiff = ai.priority != null && ai.priority !== cur.priority;
    const isApplying = applying.has(c._id);
    const isSelected = selected.has(c._id);
    const confidenceValue = c.aiConfidence ?? Number(ai.confidence ?? 0) / 100;
    const complaintText =
      c.description ??
      c.refinedText ??
      c.rawText ??
      t("hod.aiReview.notAvailable");

    return (
      <TouchableOpacity
        activeOpacity={selectMode ? 0.7 : 1}
        onPress={() => selectMode && toggleSelect(c._id)}
        onLongPress={() => {
          if (!selectMode) {
            setSelectMode(true);
            toggleSelect(c._id);
          }
        }}
      >
        <Card
          style={{
            margin: 0,
            marginBottom: 12,
            flex: 0,
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? colors.info : colors.border,
          }}
        >
          {/* Header row */}
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-row items-center flex-1">
              {selectMode && (
                <TouchableOpacity
                  onPress={() => toggleSelect(c._id)}
                  className="mr-2"
                >
                  {isSelected ? (
                    <CheckSquare size={20} color={colors.info} />
                  ) : (
                    <Square size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              )}
              <View className="flex-1">
                <Text
                  className="text-xs font-mono"
                  style={{ color: colors.textSecondary }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {c.ticketId}
                </Text>
                <Text
                  className="text-sm font-semibold mt-0.5"
                  style={{ color: colors.textPrimary }}
                  numberOfLines={2}
                >
                  {complaintText}
                </Text>
              </View>
            </View>
            <ConfidenceBadge value={confidenceValue} colors={colors} t={t} />
          </View>

          {/* Sentiment + urgency */}
          <View className="flex-row items-center mb-3">
            <SentimentBadge sentiment={ai.sentiment} colors={colors} t={t} />
            {ai.urgency != null && (
              <View className="flex-row items-center ml-2">
                <Zap size={11} color={colors.warning} />
                <Text
                  className="text-xs ml-0.5"
                  style={{ color: colors.textSecondary }}
                >
                  {t("hod.aiReview.urgency", { value: ai.urgency })}
                </Text>
              </View>
            )}
            {ai.affectedCount != null && (
              <View className="flex-row items-center ml-2">
                <Text
                  className="text-xs"
                  style={{ color: colors.textSecondary }}
                >
                  {t("hod.aiReview.affected", { count: ai.affectedCount })}
                </Text>
              </View>
            )}
          </View>

          {/* Keywords */}
          {ai.keywords && ai.keywords.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mb-3">
              {ai.keywords.map((kw, i) => (
                <View
                  key={i}
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.info + "18" }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: colors.info }}
                  >
                    {kw}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Diff rows */}
          <View
            className="rounded-lg p-3 mb-3"
            style={{ backgroundColor: colors.backgroundSecondary }}
          >
            <Text
              className="text-xs font-semibold mb-2"
              style={{ color: colors.info }}
            >
              {t("hod.aiReview.suggestionsTitle")}
            </Text>
            {deptDiff && (
              <DiffRow
                label={t("hod.aiReview.labels.department")}
                current={cur.department ?? t("hod.aiReview.notAvailable")}
                suggested={ai.department ?? t("hod.aiReview.notAvailable")}
                colors={colors}
              />
            )}
            {priorityDiff && (
              <DiffRow
                label={t("hod.aiReview.labels.priority")}
                current={cur.priority ?? t("hod.aiReview.notAvailable")}
                suggested={ai.priority ?? t("hod.aiReview.notAvailable")}
                colors={colors}
              />
            )}
            {!deptDiff && !priorityDiff && (
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {t("hod.aiReview.priorityOnly")}
              </Text>
            )}
          </View>

          {/* Reasoning */}
          {ai.reasoning && (
            <Text
              className="text-xs mb-3 italic"
              style={{ color: colors.textSecondary }}
              numberOfLines={2}
            >
              {ai.reasoning}
            </Text>
          )}

          {/* Action buttons */}
          {!selectMode && (
            <View className="flex-row flex-wrap gap-2">
              {deptDiff && (
                <TouchableOpacity
                  onPress={() => applyOne(c._id, true, false)}
                  disabled={isApplying}
                  className="flex-row items-center px-3 py-1.5 rounded-lg"
                  style={{
                    backgroundColor: colors.info + "20",
                    borderWidth: 1,
                    borderColor: colors.info,
                  }}
                >
                  <Layers size={13} color={colors.info} />
                  <Text
                    className="text-xs font-semibold ml-1"
                    style={{ color: colors.info }}
                  >
                    {t("hod.aiReview.actions.applyDepartment")}
                  </Text>
                </TouchableOpacity>
              )}
              {priorityDiff && (
                <TouchableOpacity
                  onPress={() => applyOne(c._id, false, true)}
                  disabled={isApplying}
                  className="flex-row items-center px-3 py-1.5 rounded-lg"
                  style={{
                    backgroundColor: colors.warning + "20",
                    borderWidth: 1,
                    borderColor: colors.warning,
                  }}
                >
                  <Tag size={13} color={colors.warning} />
                  <Text
                    className="text-xs font-semibold ml-1"
                    style={{ color: colors.warning }}
                  >
                    {t("hod.aiReview.actions.applyPriority")}
                  </Text>
                </TouchableOpacity>
              )}
              {deptDiff && priorityDiff && (
                <TouchableOpacity
                  onPress={() => applyOne(c._id, true, true)}
                  disabled={isApplying}
                  className="flex-row items-center px-3 py-1.5 rounded-lg"
                  style={{
                    backgroundColor: colors.primary + "20",
                    borderWidth: 1,
                    borderColor: colors.primary,
                  }}
                >
                  <CheckCircle size={13} color={colors.primary} />
                  <Text
                    className="text-xs font-semibold ml-1"
                    style={{ color: colors.primary }}
                  >
                    {t("hod.aiReview.actions.applyBoth")}
                  </Text>
                </TouchableOpacity>
              )}
              {isApplying && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </View>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={
          complaints.length
            ? t("hod.aiReview.titleWithCount", { count: complaints.length })
            : t("hod.aiReview.title")
        }
        onBack={() => router.back()}
        rightElement={
          complaints.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                if (selectMode) {
                  setSelectMode(false);
                  setSelected(new Set());
                } else {
                  setSelectMode(true);
                }
              }}
              className="px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor: selectMode
                  ? colors.backgroundSecondary
                  : colors.info + "20",
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{
                  color: selectMode ? colors.textSecondary : colors.info,
                }}
              >
                {selectMode
                  ? t("hod.aiReview.actions.cancel")
                  : t("hod.aiReview.actions.select")}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View className="flex-1 justify-center items-center">
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
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Card style={{ margin: 0, marginTop: 24 }}>
              <View className="items-center py-10">
                <View
                  className="w-16 h-16 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: colors.success + "20" }}
                >
                  <CheckCircle size={32} color={colors.success} />
                </View>
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  {t("hod.aiReview.empty.title")}
                </Text>
                <Text
                  className="text-sm mt-1 text-center"
                  style={{ color: colors.textSecondary }}
                >
                  {t("hod.aiReview.empty.description")}
                </Text>
              </View>
            </Card>
          }
        />
      )}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <View
          className="absolute bottom-24 left-4 right-4 rounded-2xl p-4 flex-row items-center justify-between"
          style={{
            backgroundColor: colors.info,
            shadowColor: colors.dark,
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.light }}
          >
            {t("hod.aiReview.bulk.selectedCount", { count: selected.size })}
          </Text>
          <TouchableOpacity
            onPress={() => setBulkModalVisible(true)}
            className="flex-row items-center px-4 py-2 rounded-xl"
            style={{ backgroundColor: colors.light + "33" }}
          >
            <CheckCircle size={16} color={colors.light} />
            <Text
              className="text-sm font-bold ml-1"
              style={{ color: colors.light }}
            >
              {t("hod.aiReview.bulk.applyCta")}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bulk apply modal */}
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
            className="rounded-t-3xl p-6"
            style={{ backgroundColor: colors.backgroundPrimary }}
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textPrimary }}
              >
                {t("hod.aiReview.bulk.modalTitle", {
                  count: selected.size,
                  plural: selected.size !== 1 ? "s" : "",
                })}
              </Text>
              <TouchableOpacity onPress={() => setBulkModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              className="text-sm mb-5"
              style={{ color: colors.textSecondary }}
            >
              {t("hod.aiReview.bulk.modalHint")}
            </Text>

            {[
              {
                id: "department",
                label: t("hod.aiReview.bulk.options.departmentOnly.label"),
                sub: t("hod.aiReview.bulk.options.departmentOnly.sub"),
                icon: Layers,
                color: colors.info,
                action: () => applyBulk(true, false),
              },
              {
                id: "priority",
                label: t("hod.aiReview.bulk.options.priorityOnly.label"),
                sub: t("hod.aiReview.bulk.options.priorityOnly.sub"),
                icon: Tag,
                color: colors.warning,
                action: () => applyBulk(false, true),
              },
              {
                id: "both",
                label: t(
                  "hod.aiReview.bulk.options.departmentAndPriority.label",
                ),
                sub: t("hod.aiReview.bulk.options.departmentAndPriority.sub"),
                icon: CheckCircle,
                color: colors.primary,
                action: () => applyBulk(true, true),
              },
            ].map(({ id, label, sub, icon: Icon, color, action }) => (
              <TouchableOpacity
                key={id}
                onPress={action}
                className="flex-row items-center p-4 rounded-xl mb-3"
                style={{
                  backgroundColor: color + "15",
                  borderWidth: 1,
                  borderColor: color + "40",
                }}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: color + "25" }}
                >
                  <Icon size={18} color={color} />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {label}
                  </Text>
                  <Text
                    className="text-xs mt-0.5"
                    style={{ color: colors.textSecondary }}
                  >
                    {sub}
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
