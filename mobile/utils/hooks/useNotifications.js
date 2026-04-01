import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import apiCall from "../api";
import { queryKeys } from "../queryKeys";
import {
  NOTIFICATION_HISTORY_URL,
  NOTIFICATION_MARK_ALL_READ_URL,
  NOTIFICATION_MARK_READ_URL,
  NOTIFICATION_PREFERENCES_URL,
} from "../../url";

async function fetchNotificationHistoryPage({ page = 1, limit = 20 }) {
  const response = await apiCall({
    method: "GET",
    url: `${NOTIFICATION_HISTORY_URL}?page=${page}&limit=${limit}`,
  });
  return response?.data ?? {};
}

export function useNotificationHistory({ page = 1, limit = 20 } = {}) {
  return useQuery({
    queryKey: queryKeys.notificationHistory({ page, limit }),
    queryFn: async () => fetchNotificationHistoryPage({ page, limit }),
  });
}

export function useInfiniteNotificationHistory({ limit = 20 } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.notificationHistoryInfinite({ limit }),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      fetchNotificationHistoryPage({ page: pageParam, limit }),
    getNextPageParam: (lastPage) => {
      const currentPage = Number(lastPage?.pagination?.page ?? 1);
      const totalPages = Number(lastPage?.pagination?.totalPages ?? 1);
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    select: (data) => {
      const pages = data.pages ?? [];
      return {
        ...data,
        pages,
        notifications: pages.flatMap((page) => page?.notifications ?? []),
        unreadCount: Number(pages[0]?.unreadCount ?? 0),
      };
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const response = await apiCall({
        method: "GET",
        url: `${NOTIFICATION_HISTORY_URL}?page=1&limit=1`,
      });
      return Number(response?.data?.unreadCount ?? 0);
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const response = await apiCall({
        method: "GET",
        url: NOTIFICATION_PREFERENCES_URL,
      });
      return response?.data ?? {};
    },
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  const syncUnreadCount = (updater) => {
    queryClient.setQueryData(queryKeys.notifications, (previous) =>
      Math.max(0, updater(Number(previous ?? 0))),
    );
  };

  const syncNotificationPages = (mapper) => {
    const entries = queryClient.getQueriesData({
      queryKey: ["notification-history"],
    });
    entries.forEach(([key, data]) => {
      if (!data) return;
      queryClient.setQueryData(key, mapper(data));
    });
  };

  const syncInfiniteNotificationPages = (mapper) => {
    const entries = queryClient.getQueriesData({
      queryKey: ["notification-history-infinite"],
    });
    entries.forEach(([key, data]) => {
      if (!data) return;
      queryClient.setQueryData(key, mapper(data));
    });
  };

  const markRead = async (notificationId) => {
    await apiCall({
      method: "PUT",
      url: NOTIFICATION_MARK_READ_URL(notificationId),
    });

    let reducedUnread = false;
    syncNotificationPages((previous) => {
      const notifications = (previous.notifications ?? []).map((item) => {
        if (item._id !== notificationId || item.readAt) return item;
        reducedUnread = true;
        return { ...item, readAt: new Date().toISOString() };
      });

      return {
        ...previous,
        notifications,
        unreadCount: reducedUnread
          ? Math.max(0, Number(previous.unreadCount ?? 0) - 1)
          : Number(previous.unreadCount ?? 0),
      };
    });

    syncInfiniteNotificationPages((previous) => {
      let infiniteReducedUnread = false;
      const pages = (previous.pages ?? []).map((page, index) => {
        const notifications = (page.notifications ?? []).map((item) => {
          if (item._id !== notificationId || item.readAt) return item;
          infiniteReducedUnread = true;
          return { ...item, readAt: new Date().toISOString() };
        });

        return {
          ...page,
          notifications,
          unreadCount:
            index === 0 && infiniteReducedUnread
              ? Math.max(0, Number(page.unreadCount ?? 0) - 1)
              : Number(page.unreadCount ?? 0),
        };
      });

      return {
        ...previous,
        pages,
        notifications: pages.flatMap((page) => page.notifications ?? []),
        unreadCount: infiniteReducedUnread
          ? Math.max(0, Number(previous.unreadCount ?? 0) - 1)
          : Number(previous.unreadCount ?? 0),
      };
    });

    if (reducedUnread) {
      syncUnreadCount((count) => count - 1);
    }
  };

  const markAllRead = async () => {
    await apiCall({
      method: "PUT",
      url: NOTIFICATION_MARK_ALL_READ_URL,
    });

    syncNotificationPages((previous) => ({
      ...previous,
      notifications: (previous.notifications ?? []).map((item) => ({
        ...item,
        readAt: item.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
    syncInfiniteNotificationPages((previous) => {
      const pages = (previous.pages ?? []).map((page) => ({
        ...page,
        notifications: (page.notifications ?? []).map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
        unreadCount: 0,
      }));

      return {
        ...previous,
        pages,
        notifications: pages.flatMap((page) => page.notifications ?? []),
        unreadCount: 0,
      };
    });
    queryClient.setQueryData(queryKeys.notifications, 0);
  };

  const updatePreferences = async (partialPreferences) => {
    const previous = queryClient.getQueryData(queryKeys.notificationPreferences);
    queryClient.setQueryData(queryKeys.notificationPreferences, (current) => ({
      ...(current || {}),
      preferences: {
        ...((current && current.preferences) || {}),
        ...(partialPreferences || {}),
      },
    }));

    try {
      const response = await apiCall({
        method: "PUT",
        url: NOTIFICATION_PREFERENCES_URL,
        data: partialPreferences,
      });
      const nextPreferences = response?.data ?? {};
      queryClient.setQueryData(
        queryKeys.notificationPreferences,
        nextPreferences,
      );
      return nextPreferences;
    } catch (error) {
      queryClient.setQueryData(
        queryKeys.notificationPreferences,
        previous ?? {},
      );
      throw error;
    }
  };

  return { markRead, markAllRead, updatePreferences };
}
