import { useFocusEffect } from "expo-router";
import {
  Bell,
  BellOff,
  CheckCheck,
  FileText,
  TriangleAlert,
  UserCheck,
  Wrench,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Switch,
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
import {
  NOTIFICATION_HISTORY_URL,
  NOTIFICATION_MARK_ALL_READ_URL,
  NOTIFICATION_MARK_READ_URL,
  NOTIFICATION_PREFERENCES_URL,
} from "../../../url";

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  "complaint-update": {
    label: "Complaint Update",
    Icon: FileText,
    color: "#3B82F6",
  },
  assignment: { label: "Assignment", Icon: UserCheck, color: "#8B5CF6" },
  escalation: { label: "Escalation", Icon: TriangleAlert, color: "#EF4444" },
  system: { label: "System", Icon: Wrench, color: "#6B7280" },
  test: { label: "Test", Icon: Bell, color: "#10B981" },
  other: { label: "Notification", Icon: Bell, color: "#F59E0B" },
};

// ─── Preference rows ──────────────────────────────────────────────────────────
const PREF_ROWS = [
  {
    key: "complaintsUpdates",
    label: "Complaint updates",
    sub: "Status changes on your complaints",
    Icon: FileText,
    color: "#3B82F6",
  },
  {
    key: "assignments",
    label: "Assignments",
    sub: "When a complaint is assigned to you",
    Icon: UserCheck,
    color: "#8B5CF6",
  },
  {
    key: "escalations",
    label: "Escalations",
    sub: "SLA breaches and priority alerts",
    Icon: TriangleAlert,
    color: "#EF4444",
  },
  {
    key: "systemAlerts",
    label: "System alerts",
    sub: "App announcements and updates",
    Icon: Wrench,
    color: "#6B7280",
  },
];

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// ─── Notification item ────────────────────────────────────────────────────────
function NotificationItem({ item, colors, onRead }) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.other;
  const { Icon } = cfg;
  const isUnread = !item.readAt;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => isUnread && onRead(item._id)}
    >
      <Card
        style={{
          margin: 0,
          marginBottom: 8,
          flex: 0,
          borderLeftWidth: 3,
          borderLeftColor: isUnread ? cfg.color : "transparent",
          opacity: isUnread ? 1 : 0.7,
        }}
      >
        <View className="flex-row items-start">
          <View
            className="w-9 h-9 rounded-full items-center justify-center mr-3 mt-0.5"
            style={{ backgroundColor: cfg.color + "22" }}
          >
            <Icon size={16} color={cfg.color} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-0.5">
              <Text
                className="text-sm font-semibold flex-1 mr-2"
                style={{ color: colors.textPrimary }}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {formatRelativeTime(item.createdAt)}
              </Text>
            </View>
            <Text
              className="text-sm leading-5"
              style={{ color: colors.textSecondary }}
              numberOfLines={3}
            >
              {item.body}
            </Text>
            {isUnread && (
              <View
                className="mt-1.5 self-start px-2 py-0.5 rounded-full"
                style={{ backgroundColor: cfg.color + "22" }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: cfg.color }}
                >
                  Tap to mark read
                </Text>
              </View>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Preference toggle row ────────────────────────────────────────────────────
function PrefRow({ row, value, colors, onChange }) {
  const { Icon } = row;
  return (
    <View
      className="flex-row items-center py-3 border-b"
      style={{ borderColor: colors.border ?? "#E5E7EB22" }}
    >
      <View
        className="w-9 h-9 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: row.color + "22" }}
      >
        <Icon size={17} color={row.color} />
      </View>
      <View className="flex-1 mr-3">
        <Text
          className="text-sm font-semibold"
          style={{ color: colors.textPrimary }}
        >
          {row.label}
        </Text>
        <Text
          className="text-xs mt-0.5"
          style={{ color: colors.textSecondary }}
        >
          {row.sub}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#6B7280", true: row.color }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { colorScheme } = useTheme();
  const { t } = useTranslation();

  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [preferences, setPreferences] = useState({
    complaintsUpdates: true,
    assignments: true,
    escalations: true,
    systemAlerts: true,
  });
  const [savingPref, setSavingPref] = useState(null); // key being saved

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadHistory = useCallback(async (page = 1, append = false) => {
    if (page === 1) {
      append ? setRefreshing(true) : setLoadingHistory(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const res = await apiCall({
        method: "GET",
        url: `${NOTIFICATION_HISTORY_URL}?page=${page}&limit=20`,
      });
      if (res?.data?.notifications) {
        setNotifications((prev) =>
          append && page > 1
            ? [...prev, ...res.data.notifications]
            : res.data.notifications,
        );
        setUnreadCount(res.data.unreadCount ?? 0);
        setPagination(res.data.pagination ?? null);
      }
    } catch {
      // silently fail — history is not critical
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const res = await apiCall({
        method: "GET",
        url: NOTIFICATION_PREFERENCES_URL,
      });
      if (res?.data?.preferences) {
        setPreferences((prev) => ({ ...prev, ...res.data.preferences }));
      }
    } catch {
      // silently fail
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory(1, false);
      loadPreferences();
    }, [loadHistory, loadPreferences]),
  );

  // ── Mark read ─────────────────────────────────────────────────────────────
  const handleMarkRead = useCallback(async (id) => {
    try {
      await apiCall({ method: "PUT", url: NOTIFICATION_MARK_READ_URL(id) });
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      Toast.show({ type: "error", text1: "Failed to mark as read" });
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await apiCall({ method: "PUT", url: NOTIFICATION_MARK_ALL_READ_URL });
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt ?? new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
      Toast.show({ type: "success", text1: "All marked as read" });
    } catch {
      Toast.show({ type: "error", text1: "Failed to mark all as read" });
    }
  }, []);

  // ── Toggle preference ─────────────────────────────────────────────────────
  const handleToggle = useCallback(async (key, value) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setSavingPref(key);
    try {
      const res = await apiCall({
        method: "PUT",
        url: NOTIFICATION_PREFERENCES_URL,
        data: { [key]: value },
      });
      if (res?.data?.preferences) {
        setPreferences((prev) => ({ ...prev, ...res.data.preferences }));
      }
    } catch {
      // revert on failure
      setPreferences((prev) => ({ ...prev, [key]: !value }));
      Toast.show({ type: "error", text1: "Failed to save preference" });
    } finally {
      setSavingPref(null);
    }
  }, []);

  // ── Pagination ────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!loadingMore && pagination && pagination.page < pagination.totalPages) {
      loadHistory(pagination.page + 1, true);
    }
  }, [loadingMore, pagination, loadHistory]);

  // ── List header (preferences + history header) ────────────────────────────
  const ListHeader = useMemo(
    () => (
      <View>
        {/* Preferences section */}
        <Card style={{ marginBottom: 16 }}>
          <Text
            className="text-base font-bold mb-1"
            style={{ color: colors.textPrimary }}
          >
            Notification Preferences
          </Text>
          <Text
            className="text-xs mb-3"
            style={{ color: colors.textSecondary }}
          >
            Choose which notifications you want to receive
          </Text>
          {PREF_ROWS.map((row) => (
            <PrefRow
              key={row.key}
              row={row}
              value={preferences[row.key] ?? true}
              colors={colors}
              onChange={(val) => handleToggle(row.key, val)}
            />
          ))}
        </Card>

        {/* History header */}
        <View className="flex-row items-center justify-between mb-2 px-1">
          <View className="flex-row items-center">
            <Text
              className="text-base font-bold"
              style={{ color: colors.textPrimary }}
            >
              Notification History
            </Text>
            {unreadCount > 0 && (
              <View
                className="ml-2 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#EF444422" }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: "#EF4444" }}
                >
                  {unreadCount} unread
                </Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              className="flex-row items-center"
              onPress={handleMarkAllRead}
            >
              <CheckCheck
                size={14}
                color="#3B82F6"
                style={{ marginRight: 4 }}
              />
              <Text
                className="text-xs font-medium"
                style={{ color: "#3B82F6" }}
              >
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    ),
    [colors, preferences, unreadCount, handleToggle, handleMarkAllRead],
  );

  const ListEmpty = useMemo(
    () =>
      loadingHistory ? (
        <ActivityIndicator
          size="small"
          color={colors.textSecondary}
          style={{ marginTop: 24 }}
        />
      ) : (
        <View className="items-center py-10">
          <BellOff size={36} color={colors.textSecondary} />
          <Text
            className="mt-3 text-sm"
            style={{ color: colors.textSecondary }}
          >
            No notifications yet
          </Text>
        </View>
      ),
    [loadingHistory, colors],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <BackButtonHeader title="Notifications" />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <NotificationItem
            item={item}
            colors={colors}
            onRead={handleMarkRead}
          />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.textSecondary}
              style={{ marginVertical: 12 }}
            />
          ) : null
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadHistory(1, true);
              loadPreferences();
            }}
            tintColor={colors.textSecondary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
