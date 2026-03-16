import { queryKeys } from "./queryKeys";

export function prependRealtimeNotification(queryClient, notification) {
  if (!notification?._id) return;

  queryClient.setQueryData(queryKeys.notifications, (previous) =>
    Number(previous ?? 0) + (notification.readAt ? 0 : 1),
  );

  const historyQueries = queryClient.getQueriesData({
    queryKey: ["notification-history"],
  });

  historyQueries.forEach(([key, data]) => {
    if (!data) return;

    const params = key?.[1] ?? {};
    const page = Number(params.page ?? 1);
    if (page !== 1) return;

    const existing = data.notifications ?? [];
    const deduped = existing.filter((item) => item._id !== notification._id);
    const limit = Number(params.limit ?? data.pagination?.limit ?? 20);
    const notifications = [notification, ...deduped].slice(0, limit);

    queryClient.setQueryData(key, {
      ...data,
      notifications,
      unreadCount: Number(data.unreadCount ?? 0) + (notification.readAt ? 0 : 1),
      pagination: data.pagination
        ? {
            ...data.pagination,
            total: Number(data.pagination.total ?? 0) + 1,
          }
        : data.pagination,
    });
  });

  const infiniteQueries = queryClient.getQueriesData({
    queryKey: ["notification-history-infinite"],
  });

  infiniteQueries.forEach(([key, data]) => {
    if (!data) return;
    const params = key?.[1] ?? {};
    const limit = Number(params.limit ?? 20);
    const existingPages = data.pages ?? [];
    const firstPage = existingPages[0] ?? {
      notifications: [],
      unreadCount: 0,
      pagination: { page: 1, limit, total: 0, totalPages: 1 },
    };

    const deduped = (firstPage.notifications ?? []).filter(
      (item) => item._id !== notification._id,
    );
    const updatedFirstPage = {
      ...firstPage,
      notifications: [notification, ...deduped].slice(0, limit),
      unreadCount:
        Number(firstPage.unreadCount ?? 0) + (notification.readAt ? 0 : 1),
      pagination: {
        ...firstPage.pagination,
        total: Number(firstPage.pagination?.total ?? 0) + 1,
      },
    };

    const pages = [updatedFirstPage, ...existingPages.slice(1)];
    queryClient.setQueryData(key, {
      ...data,
      pages,
      notifications: pages.flatMap((page) => page.notifications ?? []),
      unreadCount: Number(data.unreadCount ?? 0) + (notification.readAt ? 0 : 1),
    });
  });
}
