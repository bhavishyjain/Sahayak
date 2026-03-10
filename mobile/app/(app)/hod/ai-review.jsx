import { useRouter } from "expo-router";
import {
  Brain,
  CheckCircle,
  ChevronRight,
  AlertCircle,
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
  ScrollView,
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

const SENTIMENT_CONFIG = {
  calm: { label: "Calm", color: "#10B981" },
  frustrated: { label: "Frustrated", color: "#F59E0B" },
  angry: { label: "Angry", color: "#F97316" },
  desperate: { label: "Desperate", color: "#EF4444" },
  unknown: { label: "Unknown", color: "#6B7280" },
};

const PRIORITY_COLOR = {
  Low: "#10B981",
  Medium: "#F59E0B",
  High: "#EF4444",
};

function ConfidenceBadge({ value, colors }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#10B981" : pct >= 75 ? "#F59E0B" : "#F97316";
  return (
    <View
      className="px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + "22" }}
    >
      <Text className="text-xs font-semibold" style={{ color }}>
        {pct}% confident
      </Text>
    </View>
  );
}

function SentimentBadge({ sentiment }) {
  const cfg = SENTIMENT_CONFIG[sentiment] ?? SENTIMENT_CONFIG.unknown;
  return (
    <View
      className="px-2 py-0.5 rounded-full ml-2"
      style={{ backgroundColor: cfg.color + "22" }}
    >
      <Text className="text-xs font-semibold" style={{ color: cfg.color }}>
        {cfg.label}
      </Text>
    </View>
  );
}

function DiffRow({ label, current, suggested, colors }) {
  const hasDiff = current !== suggested;
  return (
    <View className="flex-row items-center mt-1">
      <Text className="text-xs w-20" style={{ color: colors.textMuted }}>
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
          <ChevronRight size={12} color={colors.textMuted} />
          <Text className="text-xs font-bold" style={{ color: "#8B5CF6" }}>
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
      setComplaints(res?.data?.complaints || []);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed to load",
        text2: e?.response?.data?.message || "Could not fetch AI review queue",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, []),
  );

  const applyOne = async (complaintId, applyDepartment, applyPriority) => {
    setApplying((prev) => new Set(prev).add(complaintId));
    try {
      await apiCall({
        method: "POST",
        url: APPLY_AI_SUGGESTION_URL(complaintId),
        data: { applyDepartment, applyPriority },
      });
      Toast.show({ type: "success", text1: "AI suggestion applied" });
      setComplaints((prev) => prev.filter((c) => c._id !== complaintId));
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: e?.response?.data?.message || "Could not apply suggestion",
      });
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
      try {
        await applyOne(id, applyDepartment, applyPriority);
        successCount++;
      } catch (_) {
        // individual errors already toasted
      }
    }
    setSelected(new Set());
    setSelectMode(false);
    Toast.show({
      type: "success",
      text1: `Applied to ${successCount} complaint${successCount !== 1 ? "s" : ""}`,
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
    const c = item;
    const ai = c.aiSuggestion ?? {};
    const cur = c.currentValues ?? {};
    const deptDiff = ai.department && ai.department !== cur.department;
    const priorityDiff = ai.priority && ai.priority !== cur.priority;
    const isApplying = applying.has(c._id);
    const isSelected = selected.has(c._id);
    const sentiment = SENTIMENT_CONFIG[ai.sentiment] ?? SENTIMENT_CONFIG.unknown;

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
            borderColor: isSelected ? "#8B5CF6" : colors.border,
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
                    <CheckSquare size={20} color="#8B5CF6" />
                  ) : (
                    <Square size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              )}
              <View className="flex-1">
                <Text
                  className="text-xs font-mono"
                  style={{ color: colors.textMuted }}
                >
                  {c.ticketId}
                </Text>
                <Text
                  className="text-sm font-semibold mt-0.5"
                  style={{ color: colors.textPrimary }}
                  numberOfLines={2}
                >
                  {c.description || c.refinedText || c.rawText}
                </Text>
              </View>
            </View>
            <ConfidenceBadge value={c.aiConfidence ?? ai.confidence / 100} colors={colors} />
          </View>

          {/* Sentiment + urgency */}
          <View className="flex-row items-center mb-3">
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: sentiment.color + "22" }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: sentiment.color }}
              >
                {sentiment.label}
              </Text>
            </View>
            {ai.urgency != null && (
              <View className="flex-row items-center ml-2">
                <Zap size={11} color="#F59E0B" />
                <Text
                  className="text-xs ml-0.5"
                  style={{ color: colors.textMuted }}
                >
                  Urgency {ai.urgency}/10
                </Text>
              </View>
            )}
            {ai.affectedCount != null && (
              <View className="flex-row items-center ml-2">
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  ~{ai.affectedCount} affected
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
                  style={{ backgroundColor: "#8B5CF618" }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: "#8B5CF6" }}
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
              style={{ color: "#8B5CF6" }}
            >
              AI Suggestions
            </Text>
            {deptDiff && (
              <DiffRow
                label="Dept"
                current={cur.department}
                suggested={ai.department}
                colors={colors}
              />
            )}
            {priorityDiff && (
              <DiffRow
                label="Priority"
                current={cur.priority}
                suggested={ai.priority}
                colors={colors}
              />
            )}
            {!deptDiff && !priorityDiff && (
              <Text className="text-xs" style={{ color: colors.textMuted }}>
                Priority suggestion only
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
                  style={{ backgroundColor: "#3B82F620", borderWidth: 1, borderColor: "#3B82F6" }}
                >
                  <Layers size={13} color="#3B82F6" />
                  <Text
                    className="text-xs font-semibold ml-1"
                    style={{ color: "#3B82F6" }}
                  >
                    Apply Dept
                  </Text>
                </TouchableOpacity>
              )}
              {priorityDiff && (
                <TouchableOpacity
                  onPress={() => applyOne(c._id, false, true)}
                  disabled={isApplying}
                  className="flex-row items-center px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#F59E0B20", borderWidth: 1, borderColor: "#F59E0B" }}
                >
                  <Tag size={13} color="#F59E0B" />
                  <Text
                    className="text-xs font-semibold ml-1"
                    style={{ color: "#F59E0B" }}
                  >
                    Apply Priority
                  </Text>
                </TouchableOpacity>
              )}
              {deptDiff && priorityDiff && (
                <TouchableOpacity
                  onPress={() => applyOne(c._id, true, true)}
                  disabled={isApplying}
                  className="flex-row items-center px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#8B5CF620", borderWidth: 1, borderColor: "#8B5CF6" }}
                >
                  <CheckCircle size={13} color="#8B5CF6" />
                  <Text
                    className="text-xs font-semibold ml-1"
                    style={{ color: "#8B5CF6" }}
                  >
                    Apply Both
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
    <View className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
      <BackButtonHeader
        title={`AI Review${complaints.length ? ` (${complaints.length})` : ""}`}
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
                backgroundColor: selectMode ? colors.backgroundSecondary : "#8B5CF620",
              }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: selectMode ? colors.textSecondary : "#8B5CF6" }}
              >
                {selectMode ? "Cancel" : "Select"}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-sm mt-3" style={{ color: colors.textSecondary }}>
            Loading AI review queue...
          </Text>
        </View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(item) => item._id}
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
                  style={{ backgroundColor: "#10B98120" }}
                >
                  <CheckCircle size={32} color="#10B981" />
                </View>
                <Text
                  className="text-base font-semibold"
                  style={{ color: colors.textPrimary }}
                >
                  All caught up!
                </Text>
                <Text
                  className="text-sm mt-1 text-center"
                  style={{ color: colors.textSecondary }}
                >
                  No complaints need AI review right now.
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
          style={{ backgroundColor: "#8B5CF6", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
        >
          <Text className="text-sm font-semibold text-white">
            {selected.size} selected
          </Text>
          <TouchableOpacity
            onPress={() => setBulkModalVisible(true)}
            className="flex-row items-center px-4 py-2 rounded-xl bg-white/20"
          >
            <CheckCircle size={16} color="white" />
            <Text className="text-sm font-bold text-white ml-1">Apply AI</Text>
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
          className="flex-1 bg-black/50 justify-end"
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
                Apply AI suggestion to {selected.size} complaint
                {selected.size !== 1 ? "s" : ""}
              </Text>
              <TouchableOpacity onPress={() => setBulkModalVisible(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text
              className="text-sm mb-5"
              style={{ color: colors.textSecondary }}
            >
              Choose what to apply where the AI suggestion differs from the
              current value:
            </Text>

            {[
              {
                label: "Department only",
                sub: "Update department to AI suggestion",
                icon: Layers,
                color: "#3B82F6",
                action: () => applyBulk(true, false),
              },
              {
                label: "Priority only",
                sub: "Update priority to AI suggestion",
                icon: Tag,
                color: "#F59E0B",
                action: () => applyBulk(false, true),
              },
              {
                label: "Department + Priority",
                sub: "Apply both AI suggestions",
                icon: CheckCircle,
                color: "#8B5CF6",
                action: () => applyBulk(true, true),
              },
            ].map(({ label, sub, icon: Icon, color, action }) => (
              <TouchableOpacity
                key={label}
                onPress={action}
                className="flex-row items-center p-4 rounded-xl mb-3"
                style={{ backgroundColor: color + "15", borderWidth: 1, borderColor: color + "40" }}
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
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
