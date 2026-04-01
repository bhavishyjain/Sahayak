import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { BellRing, Clock3, History, Send } from "lucide-react-native";
import { darkColors, lightColors } from "../../../colors";
import AppTextInput from "../../../components/AppTextInput";
import BackButtonHeader from "../../../components/BackButtonHeader";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import { queryKeys } from "../../../utils/queryKeys";
import { useTheme } from "../../../utils/context/theme";
import { ADMIN_NOTIFICATION_BROADCASTS_URL } from "../../../url";

function formatTimestamp(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

function SimpleInput({
  value,
  onChangeText,
  placeholder,
  colors,
  multiline = false,
}) {
  return (
    <AppTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      multiline={multiline}
      backgroundColor={colors.backgroundPrimary}
      inputContainerStyle={{
        backgroundColor: colors.backgroundPrimary,
        minHeight: multiline ? 120 : 48,
      }}
      inputStyle={{
        fontSize: 14,
        minHeight: multiline ? 120 : 48,
      }}
    />
  );
}

export default function AdminSendNotificationScreen() {
  const { colorScheme } = useTheme();
  const { t } = useTranslation();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceKey, setAudienceKey] = useState("all");
  const [saving, setSaving] = useState(false);

  const audienceOptions = useMemo(
    () => [
      {
        key: "all",
        label: t("more.menu.adminSendNotification.form.audienceOptions.all"),
        roles: [],
      },
      {
        key: "user",
        label: t("more.menu.adminSendNotification.form.audienceOptions.user"),
        roles: ["user"],
      },
      {
        key: "worker",
        label: t("more.menu.adminSendNotification.form.audienceOptions.worker"),
        roles: ["worker"],
      },
      {
        key: "head",
        label: t("more.menu.adminSendNotification.form.audienceOptions.head"),
        roles: ["head"],
      },
      {
        key: "admin",
        label: t("more.menu.adminSendNotification.form.audienceOptions.admin"),
        roles: ["admin"],
      },
    ],
    [t],
  );

  const selectedAudience =
    audienceOptions.find((option) => option.key === audienceKey) ||
    audienceOptions[0];

  const {
    data: historyData,
    isLoading: loading,
  } = useQuery({
    queryKey: [...queryKeys.notifications, "admin-broadcasts"],
    queryFn: async () => {
      const response = await apiCall({
        method: "GET",
        url: `${ADMIN_NOTIFICATION_BROADCASTS_URL}?limit=30`,
      });
      return response?.data ?? {};
    },
  });

  const sortedHistory = useMemo(
    () =>
      [...(Array.isArray(historyData?.broadcasts) ? historyData.broadcasts : [])].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [historyData?.broadcasts],
  );

  const handleSend = async () => {
    const nextTitle = title.trim();
    const nextBody = body.trim();

    if (!nextTitle || !nextBody) {
      Toast.show({
        type: "error",
        text1: t("more.menu.adminSendNotification.toasts.missingDetailsTitle"),
        text2: t("more.menu.adminSendNotification.toasts.missingDetailsMessage"),
      });
      return;
    }

    try {
      setSaving(true);
      await apiCall({
        method: "POST",
        url: ADMIN_NOTIFICATION_BROADCASTS_URL,
        data: {
          title: nextTitle,
          body: nextBody,
          roles: selectedAudience.roles,
        },
      });
      await queryClient.invalidateQueries({
        queryKey: [...queryKeys.notifications, "admin-broadcasts"],
      });
      setTitle("");
      setBody("");
      Toast.show({
        type: "success",
        text1: t("more.menu.adminSendNotification.toasts.sentTitle"),
        text2: t("more.menu.adminSendNotification.toasts.sentMessage", {
          audience: selectedAudience.label,
        }),
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t("more.menu.adminSendNotification.toasts.failedTitle"),
        text2:
          error?.response?.data?.message ||
          t("more.menu.adminSendNotification.toasts.failedMessage"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
      <BackButtonHeader title={t("more.menu.adminSendNotification.title")} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4">
          <Text
            className="text-base font-semibold"
            style={{ color: colors.textPrimary }}
          >
            {t("more.menu.adminSendNotification.form.title")}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            {t("more.menu.adminSendNotification.form.subtitle")}
          </Text>
        </View>

        <View
          className="rounded-2xl p-4 mb-5"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            className="text-xs font-semibold mb-2"
            style={{ color: colors.textSecondary }}
          >
            {t("more.menu.adminSendNotification.form.fields.title")}
          </Text>
          <SimpleInput
            value={title}
            onChangeText={setTitle}
            placeholder={t("more.menu.adminSendNotification.form.placeholders.title")}
            colors={colors}
          />

          <Text
            className="text-xs font-semibold mt-4 mb-2"
            style={{ color: colors.textSecondary }}
          >
            {t("more.menu.adminSendNotification.form.fields.message")}
          </Text>
          <SimpleInput
            value={body}
            onChangeText={setBody}
            placeholder={t("more.menu.adminSendNotification.form.placeholders.message")}
            colors={colors}
            multiline={true}
          />

          <Text
            className="text-xs font-semibold mt-4 mb-2"
            style={{ color: colors.textSecondary }}
          >
            {t("more.menu.adminSendNotification.form.fields.audience")}
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {audienceOptions.map((option) => {
              const active = option.key === audienceKey;
              return (
                <PressableBlock
                  key={option.key}
                  onPress={() => setAudienceKey(option.key)}
                  className="px-3.5 py-2 rounded-full"
                  style={{
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active
                      ? colors.primary + "18"
                      : colors.backgroundPrimary,
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{
                      color: active ? colors.primary : colors.textPrimary,
                    }}
                  >
                    {option.label}
                  </Text>
                </PressableBlock>
              );
            })}
          </View>

          <Text className="text-xs mt-3" style={{ color: colors.textSecondary }}>
            {t("more.menu.adminSendNotification.form.helper", {
              audience: selectedAudience.label,
            })}
          </Text>

          <PressableBlock
            onPress={handleSend}
            disabled={saving}
            className="rounded-2xl py-4 items-center mt-4"
            style={{
              backgroundColor: saving ? colors.border : colors.primary,
              opacity: saving ? 0.75 : 1,
            }}
          >
            <View className="flex-row items-center">
              <Send size={16} color={colors.dark} />
              <Text className="text-sm font-semibold ml-2" style={{ color: colors.dark }}>
                {saving
                  ? t("more.menu.adminSendNotification.form.sending")
                  : t("more.menu.adminSendNotification.form.send")}
              </Text>
            </View>
          </PressableBlock>
        </View>

        <View>
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                {t("more.menu.adminSendNotification.history.title")}
              </Text>
            </View>
            <History size={17} color={colors.textSecondary} />
          </View>

          {loading ? (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {t("more.menu.adminSendNotification.history.loading")}
            </Text>
          ) : sortedHistory.length === 0 ? (
            <View
              className="rounded-2xl p-5"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                {t("more.menu.adminSendNotification.history.empty")}
              </Text>
            </View>
          ) : (
            sortedHistory.map((item) => (
              <View
                key={String(item._id || item.id || item.createdAt)}
                className="rounded-2xl p-4 mb-3"
                style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <Text
                    className="text-sm font-semibold flex-1 pr-3"
                    style={{ color: colors.textPrimary }}
                  >
                    {item.title}
                  </Text>
                  <View
                    className="px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: colors.primary + "18" }}
                  >
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: colors.primary }}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <Text
                  className="text-xs leading-5"
                  style={{ color: colors.textSecondary }}
                >
                  {item.body}
                </Text>

                <View
                  className="flex-row items-center justify-between mt-4 pt-3"
                  style={{ borderTopWidth: 1, borderTopColor: colors.border }}
                >
                  <View className="flex-row items-center flex-1 pr-3">
                    <BellRing size={14} color={colors.textSecondary} />
                    <Text
                      className="text-xs ml-2"
                      style={{ color: colors.textSecondary }}
                    >
                      {item.audienceLabel ||
                        t("more.menu.adminSendNotification.form.audienceOptions.all")}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Clock3 size={13} color={colors.textSecondary} />
                    <Text className="text-xs ml-2" style={{ color: colors.textSecondary }}>
                      {formatTimestamp(item.createdAt)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row mt-3" style={{ gap: 8 }}>
                  <Text className="text-[11px]" style={{ color: colors.textSecondary }}>
                    {t("more.menu.adminSendNotification.history.metrics.recipients", {
                      count: Number(item.recipientCount ?? 0),
                    })}
                  </Text>
                  <Text className="text-[11px]" style={{ color: colors.textSecondary }}>
                    {t("more.menu.adminSendNotification.history.metrics.delivered", {
                      count: Number(item.deliveredCount ?? 0),
                    })}
                  </Text>
                  <Text className="text-[11px]" style={{ color: colors.textSecondary }}>
                    {t("more.menu.adminSendNotification.history.metrics.pushSent", {
                      count: Number(item.pushSentCount ?? 0),
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
