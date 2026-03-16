import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import apiCall from "../api";
import { queryKeys } from "../queryKeys";
import {
  GET_COMPLAINT_MESSAGES_URL,
  POST_COMPLAINT_MESSAGE_URL,
} from "../../url";

export function useComplaintChat(complaintId, { limit = 50 } = {}) {
  const queryClient = useQueryClient();

  const messagesQuery = useInfiniteQuery({
    queryKey: queryKeys.complaintMessages(complaintId, limit),
    enabled: Boolean(complaintId),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await apiCall({
        method: "GET",
        url: `${GET_COMPLAINT_MESSAGES_URL(complaintId)}?page=${pageParam}`,
      });
      return response?.data ?? {};
    },
    getNextPageParam: (lastPage, allPages) => {
      const total = Number(lastPage?.total ?? 0);
      const pageSize = Number(lastPage?.pageSize ?? limit);
      return allPages.length * pageSize < total ? allPages.length + 1 : undefined;
    },
    select: (data) => {
      const pages = data.pages ?? [];
      return {
        ...data,
        pages,
        messages: pages.flatMap((page) => page?.messages ?? []),
      };
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (text) => {
      const response = await apiCall({
        method: "POST",
        url: POST_COMPLAINT_MESSAGE_URL(complaintId),
        data: { text },
      });
      return response?.data?.message ?? null;
    },
    onSuccess: (newMessage) => {
      if (!newMessage) return;
      queryClient.setQueryData(
        queryKeys.complaintMessages(complaintId, limit),
        (previous) => {
          if (!previous?.pages?.length) return previous;
          const pages = [...previous.pages];
          const firstPage = { ...(pages[0] || {}) };
          const existingMessages = firstPage.messages ?? [];
          if (
            existingMessages.some(
              (message) => String(message?._id) === String(newMessage?._id),
            )
          ) {
            return previous;
          }
          firstPage.messages = [...existingMessages, newMessage];
          firstPage.total = Number(firstPage.total ?? 0) + 1;
          pages[0] = firstPage;
          return {
            ...previous,
            pages,
            messages: pages.flatMap((page) => page?.messages ?? []),
          };
        },
      );
    },
  });

  const appendRealtimeMessage = (incomingMessage) => {
    if (!incomingMessage?._id) return;
    queryClient.setQueryData(
      queryKeys.complaintMessages(complaintId, limit),
      (previous) => {
        if (!previous?.pages?.length) return previous;
        const pages = [...previous.pages];
        const firstPage = { ...(pages[0] || {}) };
        const existingMessages = firstPage.messages ?? [];
        if (
          existingMessages.some(
            (message) => String(message?._id) === String(incomingMessage?._id),
          )
        ) {
          return previous;
        }
        firstPage.messages = [...existingMessages, incomingMessage];
        firstPage.total = Number(firstPage.total ?? 0) + 1;
        pages[0] = firstPage;
        return {
          ...previous,
          pages,
          messages: pages.flatMap((page) => page?.messages ?? []),
        };
      },
    );
  };

  return {
    messages: messagesQuery.data?.messages ?? [],
    isLoading: messagesQuery.isLoading,
    isRefreshing: messagesQuery.isRefetching,
    hasMore: Boolean(messagesQuery.hasNextPage),
    loadingMore: messagesQuery.isFetchingNextPage,
    refetch: messagesQuery.refetch,
    loadMore: messagesQuery.fetchNextPage,
    sendMessage: sendMutation.mutateAsync,
    sending: sendMutation.isPending,
    appendRealtimeMessage,
  };
}
