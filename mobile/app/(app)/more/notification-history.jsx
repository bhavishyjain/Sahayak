import { useFocusEffect, useRouter } from "expo-router";
import {
  Bell,
  BellOff,
  CheckCheck,
  FileText,
  TriangleAlert,
  UserCheck,
  Wrench,
} from "lucide-react-native";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import { useTheme } from "../../../utils/context/theme";
import {
  useNotificationActions,
  useInfiniteNotificationHistory,
} from "../../../utils/hooks/useNotifications";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { openNotificationRoute } from "../../../utils/notificationNavigation";

const getTypeConfig = (colors) => ({
  "complaint-update": { Icon: FileText, color: colors.info },
  assignment: { Icon: UserCheck, color: colors.primary },
  escalation: { Icon: TriangleAlert, color: colors.danger },
  system: { Icon: Wrench, color: colors.secondary },
  test: { Icon: Bell, color: colors.success },
  other: { Icon: Bell, color: colors.warning },
});

function formatRelativeTime(t, dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return t("time.justNow");
  if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return t("time.minutesAgo", {
      count: minutes,
      plural: minutes === 1 ? "" : "s",
    });
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return t("time.hoursAgo", {
      count: hours,
      plural: hours === 1 ? "" : "s",
    });
  }
  const days = Math.floor(diff / 86400);
  if (days <= 7) {
    return t("time.daysAgo", {
      count: days,
      plural: days === 1 ? "" : "s",
    });
  }
  return new Date(dateStr).toLocaleDateString();
}

function NotificationItem({ item, colors, onRead, t, typeConfig }) {
  const cfg = typeConfig[item.type] || typeConfig.other;
  const { Icon } = cfg;
  const isUnread = !item.readAt;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => isUnread && onRead(item._id)}
    >
      <View
        className="flex-row items-start px-4 py-4"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: isUnread ? cfg.color + "14" : "transparent",
        }}
      >
        <View
          className="w-9 h-9 rounded-full items-center justify-center mr-3 mt-0.5"
          style={{ backgroundColor: cfg.color + "20" }}
        >
          <Icon size={16} color={cfg.color} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-start justify-between mb-1">
            <Text
              className="text-base font-bold flex-1 mr-3"
              style={{ color: colors.textPrimary }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {formatRelativeTime(t, item.createdAt)}
            </Text>
          </View>
          <Text
            className="text-sm leading-5"
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

export default function NotificationHistoryScreen() {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const { t } = useTranslation();
  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );
  const typeConfig = useMemo(() => getTypeConfig(colors), [colors]);

  const {
    data,
    isLoading: loadingHistory,
    isRefetching: refreshing,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteNotificationHistory({ limit: 20 });
  const { markRead, markAllRead } = useNotificationActions();

  const notifications = data?.notifications ?? [];
  const unreadCount = Number(data?.unreadCount ?? 0);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleOpenNotification = useCallback(
    async (item) => {
      if (!item?.readAt) {
        try {
          await markRead(item._id);
        } catch {
        }
      }

      openNotificationRoute(item?.data, router);
    },
    [markRead, router],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllRead();
      Toast.show({
        type: "success",
        text1: t("more.notificationsScreen.toasts.markAllReadSuccess"),
      });
    } catch {
      Toast.show({
        type: "error",
        text1: t("more.notificationsScreen.toasts.markAllReadFailed"),
      });
    }
  }, [markAllRead, t]);

  const ListHeader = useMemo(
    () => (
      <View>
        <View
          className="flex-row items-center justify-between px-4 py-3"
          style={{
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.backgroundPrimary,
          }}
        >
          <View className="flex-row items-center">
            <Text
              className="text-xs font-semibold uppercase"
              style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
            >
              {t("more.notificationsScreen.history.title")}
            </Text>
            {unreadCount > 0 && (
              <View
                className="ml-2 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: colors.danger + "20" }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: colors.danger }}
                >
                  {t("more.notificationsScreen.history.unread", {
                    count: unreadCount,
                  })}
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
                {t("more.notificationsScreen.history.markAllRead")}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    ),
    [colors, unreadCount, handleMarkAllRead, t],
  );

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("more.notificationsScreen.history.title")} />

      {loadingHistory ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          style={{ flex: 1 }}
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              colors={colors}
              onRead={() => handleOpenNotification(item)}
              t={t}
              typeConfig={typeConfig}
            />
          )}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View
              className="items-center justify-center px-8"
              style={{
                flex: 1,
                minHeight: 320,
              }}
            >
              <BellOff size={32} color={colors.textSecondary} />
              <Text
                className="text-sm mt-3"
                style={{ color: colors.textSecondary }}
              >
                {t("more.notificationsScreen.empty")}
              </Text>
            </View>
          }
          ListFooterComponent={
            notifications.length > 0 ? (
              <View
                style={{
                  height: 14,
                  backgroundColor: colors.backgroundPrimary,
                }}
              />
            ) : null
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 56 }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refetch()}
              tintColor={colors.textSecondary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={null}
        />
      )}

      {isFetchingNextPage ? (
        <View className="pb-5">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}
