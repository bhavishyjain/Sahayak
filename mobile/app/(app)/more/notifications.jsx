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
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import {
  NOTIFICATION_HISTORY_URL,
  NOTIFICATION_MARK_ALL_READ_URL,
  NOTIFICATION_MARK_READ_URL,
  NOTIFICATION_PREFERENCES_URL,
} from "../../../url";

const TYPE_CONFIG = {
  "complaint-update": { Icon: FileText, color: "#3B82F6" },
  assignment: { Icon: UserCheck, color: "#8B5CF6" },
  escalation: { Icon: TriangleAlert, color: "#EF4444" },
  system: { Icon: Wrench, color: "#6B7280" },
  test: { Icon: Bell, color: "#10B981" },
  other: { Icon: Bell, color: "#F59E0B" },
};

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

function NotificationItem({ item, colors, onRead }) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.other;
  const { Icon } = cfg;
  const isUnread = !item.readAt;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => isUnread && onRead(item._id)}
    >
      <View
        className="flex-row items-start px-4 py-3.5"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: isUnread ? cfg.color + "08" : "transparent",
        }}
      >
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-3 mt-0.5"
          style={{ backgroundColor: cfg.color + "20" }}
        >
          <Icon size={15} color={cfg.color} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between mb-0.5">
            <Text
              className="text-sm font-semibold flex-1 mr-3"
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
            className="text-xs leading-5"
            style={{ color: colors.textSecondary }}
            numberOfLines={3}
          >
            {item.body}
          </Text>
        </View>
        {isUnread && (
          <View
            className="w-2 h-2 rounded-full ml-2 mt-1.5"
            style={{ backgroundColor: cfg.color }}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

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
  const [savingPref, setSavingPref] = useState(null);

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
      /* silently fail */
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
      /* silently fail */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory(1, false);
      loadPreferences();
    }, [loadHistory, loadPreferences]),
  );

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
      setPreferences((prev) => ({ ...prev, [key]: !value }));
      Toast.show({ type: "error", text1: "Failed to save preference" });
    } finally {
      setSavingPref(null);
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && pagination && pagination.page < pagination.totalPages) {
      loadHistory(pagination.page + 1, true);
    }
  }, [loadingMore, pagination, loadHistory]);

  const ListHeader = useMemo(
    () => (
      <View>
        {/* Preferences */}
        <Text
          className="text-xs font-semibold uppercase mb-3"
          style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
        >
          Preferences
        </Text>
        <View
          className="rounded-2xl overflow-hidden mb-6"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {PREF_ROWS.map(({ key, label, sub, Icon, color }, idx) => (
            <View key={key}>
              <View className="flex-row items-center px-4 py-3.5">
                <View
                  className="w-8 h-8 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: color + "20" }}
                >
                  <Icon size={16} color={color} />
                </View>
                <View className="flex-1 mr-3">
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
                {savingPref === key ? (
                  <ActivityIndicator size="small" color={color} />
                ) : (
                  <Switch
                    value={preferences[key] ?? true}
                    onValueChange={(val) => handleToggle(key, val)}
                    trackColor={{ false: colors.border, true: color }}
                    thumbColor="#FFFFFF"
                  />
                )}
              </View>
              {idx < PREF_ROWS.length - 1 && (
                <View
                  className="h-[1px] ml-14"
                  style={{ backgroundColor: colors.border }}
                />
              )}
            </View>
          ))}
        </View>

        {/* History header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Text
              className="text-xs font-semibold uppercase"
              style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
            >
              History
            </Text>
            {unreadCount > 0 && (
              <View
                className="ml-2 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#EF444420" }}
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
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <CheckCheck size={13} color={colors.primary} />
              <Text
                className="text-xs font-medium ml-1"
                style={{ color: colors.primary }}
              >
                Mark all read
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* History container top border */}
        {notifications.length > 0 && (
          <View
            className="rounded-t-2xl overflow-hidden"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1,
              borderColor: colors.border,
              borderBottomWidth: 0,
            }}
          />
        )}
      </View>
    ),
    [
      colors,
      preferences,
      unreadCount,
      savingPref,
      notifications.length,
      handleToggle,
      handleMarkAllRead,
    ],
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title="Notifications" />

      {loadingHistory ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
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
          ListEmptyComponent={
            <View
              className="rounded-2xl items-center py-12"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <BellOff size={32} color={colors.textSecondary} />
              <Text
                className="text-sm mt-3"
                style={{ color: colors.textSecondary }}
              >
                No notifications yet
              </Text>
            </View>
          }
          ListFooterComponent={
            notifications.length > 0 ? (
              <View
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderTopWidth: 0,
                  borderBottomLeftRadius: 16,
                  borderBottomRightRadius: 16,
                  height: 8,
                  marginBottom: 16,
                }}
              />
            ) : null
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
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
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={null}
        />
      )}

      {loadingMore && (
        <ActivityIndicator
          size="small"
          color={colors.textSecondary}
          style={{ position: "absolute", bottom: 24, alignSelf: "center" }}
        />
      )}
    </View>
  );
}
