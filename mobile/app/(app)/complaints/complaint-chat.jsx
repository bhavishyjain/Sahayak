import { useLocalSearchParams } from "expo-router";
import { Clock, MessageSquare, Send } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import AppTextInput from "../../../components/AppTextInput";
import BackButtonHeader from "../../../components/BackButtonHeader";
import {
  addRealtimeListener,
  subscribeToComplaint,
  unsubscribeFromComplaint,
} from "../../../utils/realtime/socket";
import { useComplaintChat } from "../../../utils/hooks/useComplaintChat";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";

const ROLE_LABEL_KEY = {
  user: "complaintChat.roles.user",
  worker: "complaintChat.roles.worker",
  head: "complaintChat.roles.head",
  admin: "complaintChat.roles.admin",
};

const ROLE_COLOR = (colors) => ({
  user: colors.primary,
  worker: colors.success,
  head: colors.warning,
  admin: colors.danger,
});

function MessageBubble({ msg, currentUserId, colors, t }) {
  const isOwn = String(msg.senderId) === String(currentUserId);
  const roleColors = ROLE_COLOR(colors);
  const roleColor = roleColors[msg.senderRole] ?? colors.primary;
  const roleLabelKey = ROLE_LABEL_KEY[msg.senderRole];
  const roleLabel = roleLabelKey ? t(roleLabelKey) : t("complaintChat.roles.unknown");
  const senderHeading =
    msg.senderRole === "worker" || msg.senderRole === "head"
      ? `${msg.senderName} • ${roleLabel}`
      : msg.senderName || roleLabel;

  const date = new Date(msg.createdAt);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <View
      className={`mb-3 max-w-[80%] ${isOwn ? "self-end items-end" : "self-start items-start"}`}
    >
      <View
        className={`flex-row items-center mb-1 gap-1 ${isOwn ? "mr-1" : "ml-1"}`}
      >
          <Text className="text-xs font-semibold" style={{ color: roleColor }}>
            {senderHeading}
          </Text>
          <View
            className="px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: roleColor + "22" }}
          >
            <Text
              className="text-[10px] font-medium"
              style={{ color: roleColor }}
            >
              {roleLabel}
            </Text>
          </View>
      </View>
      <View
        className="px-4 py-3 rounded-2xl"
        style={{
          backgroundColor: isOwn ? colors.primary : colors.backgroundSecondary,
          borderBottomRightRadius: isOwn ? 4 : 16,
          borderBottomLeftRadius: isOwn ? 16 : 4,
        }}
      >
        <Text
          className="text-sm leading-relaxed"
          style={{ color: isOwn ? colors.light : colors.textPrimary }}
        >
          {msg.text}
        </Text>
      </View>
      <View className="flex-row items-center mt-1 mx-1">
        <Clock size={10} color={colors.textSecondary} style={{ marginRight: 4 }} />
        <Text className="text-[10px]" style={{ color: colors.textSecondary }}>
          {dateStr} {timeStr}
        </Text>
      </View>
    </View>
  );
}

export default function ComplaintChat() {
  const { id, ticketId } = useLocalSearchParams();
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const insets = useSafeAreaInsets();

  const [text, setText] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [composerInputHeight, setComposerInputHeight] = useState(48);
  const [composerHeight, setComposerHeight] = useState(84);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const flatListRef = useRef(null);
  const {
    messages,
    isLoading: loading,
    hasMore,
    loadingMore,
    loadMore,
    sendMessage,
    sending,
    appendRealtimeMessage,
  } = useComplaintChat(id);

  useEffect(() => {
    const init = async () => {
      const user = await getUserAuth();
      setCurrentUserId(String(user?.id ?? user?._id ?? ""));
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: false }),
        100,
      );
    };
    if (id) init();
  }, [id]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(0, event?.endCoordinates?.height || 0));
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!id) return undefined;

    subscribeToComplaint(id).catch(() => {});
    const unsubscribeMessageListener = addRealtimeListener(
      "complaint-message",
      (payload) => {
        if (String(payload?.complaintId || "") !== String(id)) return;
        const incomingMessage = payload?.message;
        if (!incomingMessage?._id) return;

        appendRealtimeMessage(incomingMessage);

        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      },
    );

    return () => {
      unsubscribeMessageListener();
      unsubscribeFromComplaint(id);
    };
  }, [appendRealtimeMessage, id]);

  const handleSend = async () => {
    const msg = text.trim();
    if ([!msg, sending].some(Boolean)) return;

    setText("");
    try {
      const newMsg = await sendMessage(msg);
      if (newMsg) {
        setTimeout(
          () => flatListRef.current?.scrollToEnd({ animated: true }),
          100,
        );
      }
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("complaintChat.toasts.sendFailedTitle"),
        text2: e?.response?.data?.message ?? t("complaintChat.toasts.tryAgain"),
      });
      // Restore text so user doesn't lose their message
      setText(msg);
    } finally {
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadMore();
    }
  };

  const discussionTitle = ticketId
    ? t("complaintChat.ticketTitle", { ticketId: String(ticketId) })
    : t("complaintChat.discussionTitle");
  const composerBottomOffset =
    keyboardHeight > 0
      ? Platform.OS === "android"
        ? keyboardHeight + 8
        : Math.max(12, keyboardHeight - insets.bottom)
      : Math.max(insets.bottom, 16);

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={t("complaintChat.threadTitle", { title: discussionTitle })}
      />

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {messages.length === 0 ? (
            <View className="flex-1 justify-center items-center px-8">
              <MessageSquare
                size={48}
                color={colors.border}
                style={{ marginBottom: 12 }}
              />
              <Text
                className="text-base font-semibold text-center mb-2"
                style={{ color: colors.textPrimary }}
              >
                {t("complaintChat.empty.title")}
              </Text>
              <Text
                className="text-sm text-center"
                style={{ color: colors.textSecondary }}
              >
                {t("complaintChat.empty.description")}
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => String(item._id)}
              renderItem={({ item }) => (
                <MessageBubble
                  msg={item}
                  currentUserId={currentUserId}
                  colors={colors}
                  t={t}
                />
              )}
              contentContainerStyle={{
                padding: 16,
                paddingBottom: composerBottomOffset + composerHeight + 12,
                flexGrow: 1,
                justifyContent: "flex-end",
              }}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() =>
                flatListRef.current?.scrollToEnd({ animated: false })
              }
              onEndReachedThreshold={0.1}
              ListHeaderComponent={
                loadingMore ? (
                  <View className="py-4 items-center">
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : hasMore ? (
                  <TouchableOpacity
                    onPress={handleLoadMore}
                    className="py-3 items-center mb-2"
                  >
                    <Text
                      className="text-sm font-medium"
                      style={{ color: colors.primary }}
                    >
                      {t("complaintChat.loadOlder")}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}

          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: composerBottomOffset + composerHeight + 8,
              backgroundColor: colors.backgroundPrimary,
            }}
          />

          <View
            className="absolute left-0 right-0 px-4 pt-2"
            onLayout={(event) => {
              setComposerHeight(event.nativeEvent.layout.height);
            }}
            style={{
              bottom: composerBottomOffset,
              backgroundColor: colors.backgroundPrimary,
            }}
          >
            <View
              className="flex-row items-end px-4 py-3 gap-3 rounded-2xl"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.backgroundPrimary,
              }}
            >
              <AppTextInput
                value={text}
                onChangeText={setText}
                placeholder={t("complaintChat.inputPlaceholder")}
                multiline
                maxLength={2000}
                onContentSizeChange={(event) => {
                  const nextHeight = Math.min(
                    120,
                    Math.max(48, event?.nativeEvent?.contentSize?.height || 48),
                  );
                  setComposerInputHeight(nextHeight);
                }}
                containerStyle={{ flex: 1 }}
                inputContainerStyle={{
                  minHeight: 48,
                  height: composerInputHeight,
                  maxHeight: 120,
                  borderWidth: 0,
                  borderRadius: 16,
                  backgroundColor: "transparent",
                }}
                inputStyle={{
                  fontSize: 14,
                  minHeight: 48,
                  height: composerInputHeight,
                  maxHeight: 120,
                  paddingVertical: 12,
                }}
                onBlur={() => {
                  if (!text.trim()) {
                    setComposerInputHeight(48);
                  }
                }}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={[!text.trim(), sending].some(Boolean)}
                className="w-11 h-11 rounded-full items-center justify-center"
                style={{
                  backgroundColor:
                    text.trim() && !sending ? colors.primary : colors.border,
                }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.light} />
                ) : (
                  <Send size={18} color={colors.light} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
