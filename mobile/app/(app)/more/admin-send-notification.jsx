import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import Toast from "react-native-toast-message";
import { BellRing, Clock3, History, Send } from "lucide-react-native";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";

const STORAGE_KEY = "admin_sent_notification_history_v1";

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
    <PaperTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      mode="flat"
      multiline={multiline}
      underlineStyle={{ display: "none" }}
      style={{
        backgroundColor: colors.backgroundPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
        minHeight: multiline ? 120 : 48,
        borderRadius: 12,
        textAlignVertical: multiline ? "top" : "center",
      }}
      contentStyle={{
        color: colors.textPrimary,
        fontSize: 14,
        paddingHorizontal: 16,
        paddingVertical: multiline ? 12 : 10,
      }}
      theme={{
        colors: {
          text: colors.textPrimary,
          placeholder: colors.textSecondary,
        },
        roundness: 12,
      }}
    />
  );
}

export default function AdminSendNotificationScreen() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        setHistory(Array.isArray(parsed) ? parsed : []);
      } catch (_error) {
        setHistory([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sortedHistory = useMemo(
    () =>
      [...history].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [history],
  );

  const handleSend = async () => {
    const nextTitle = title.trim();
    const nextBody = body.trim();

    if (!nextTitle || !nextBody) {
      Toast.show({
        type: "error",
        text1: "Missing details",
        text2: "Add both a notification title and body.",
      });
      return;
    }

    const record = {
      id: `${Date.now()}`,
      title: nextTitle,
      body: nextBody,
      audience: "All users",
      createdAt: new Date().toISOString(),
      status: "Pending backend delivery",
    };

    try {
      setSaving(true);
      const nextHistory = [record, ...history].slice(0, 30);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
      setHistory(nextHistory);
      setTitle("");
      setBody("");
      Toast.show({
        type: "info",
        text1: "Saved to sent history",
        text2: "Delivery still needs the backend admin-notification API.",
      });
    } catch (_error) {
      Toast.show({
        type: "error",
        text1: "Could not save history",
        text2: "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
      <BackButtonHeader title="Send Notification" />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mb-4">
          <Text
            className="text-base font-semibold"
            style={{ color: colors.textPrimary }}
          >
            Create notification
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
            Draft a notification to save in admin send history.
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
            Title
          </Text>
          <SimpleInput
            value={title}
            onChangeText={setTitle}
            placeholder="Notification title"
            colors={colors}
          />

          <Text
            className="text-xs font-semibold mt-4 mb-2"
            style={{ color: colors.textSecondary }}
          >
            Message
          </Text>
          <SimpleInput
            value={body}
            onChangeText={setBody}
            placeholder="Notification body"
            colors={colors}
            multiline={true}
          />

          <Text className="text-xs mt-3" style={{ color: colors.textSecondary }}>
            Saved locally until admin broadcast API is available.
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
                {saving ? "Saving..." : "Send Notification"}
              </Text>
            </View>
          </PressableBlock>
        </View>

        <View>
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                Sent history
              </Text>
            </View>
            <History size={17} color={colors.textSecondary} />
          </View>

          {loading ? (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Loading history...
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
                No sent notifications yet.
              </Text>
            </View>
          ) : (
            sortedHistory.map((item) => (
              <View
                key={item.id}
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
                      {item.audience}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Clock3 size={13} color={colors.textSecondary} />
                    <Text className="text-xs ml-2" style={{ color: colors.textSecondary }}>
                      {formatTimestamp(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
