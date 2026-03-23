import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import Toast from "react-native-toast-message";
import { BellRing, History, Send } from "lucide-react-native";
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
        <View
          className="rounded-2xl p-4 mb-4"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center mb-3">
            <View
              className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
              style={{ backgroundColor: colors.primary + "18" }}
            >
              <Send size={18} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                Create notification
              </Text>
              <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                Write the admin notification you want to send.
              </Text>
            </View>
          </View>

          <PaperTextInput
            mode="outlined"
            label="Notification title"
            value={title}
            onChangeText={setTitle}
            style={{ marginBottom: 12, backgroundColor: colors.backgroundPrimary }}
          />
          <PaperTextInput
            mode="outlined"
            label="Notification body"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={5}
            style={{ marginBottom: 14, backgroundColor: colors.backgroundPrimary }}
          />

          <View
            className="rounded-xl px-3 py-3 mb-4"
            style={{ backgroundColor: colors.warning + "14" }}
          >
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              The backend does not yet expose an admin broadcast endpoint. This page keeps a history
              of notifications drafted and sent from here only.
            </Text>
          </View>

          <PressableBlock
            onPress={handleSend}
            disabled={saving}
            className="rounded-2xl py-4 items-center"
            style={{
              backgroundColor: saving ? colors.border : colors.primary,
              opacity: saving ? 0.75 : 1,
            }}
          >
            <Text className="text-sm font-semibold" style={{ color: colors.dark }}>
              {saving ? "Saving..." : "Send Notification"}
            </Text>
          </PressableBlock>
        </View>

        <View
          className="rounded-2xl p-4"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View className="flex-row items-center mb-4">
            <View
              className="w-11 h-11 rounded-2xl items-center justify-center mr-3"
              style={{ backgroundColor: colors.info + "18" }}
            >
              <History size={18} color={colors.info} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                Sent history
              </Text>
              <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                Only notifications created from this page are shown here.
              </Text>
            </View>
          </View>

          {loading ? (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              Loading history...
            </Text>
          ) : sortedHistory.length === 0 ? (
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              No sent notifications yet.
            </Text>
          ) : (
            sortedHistory.map((item) => (
              <View
                key={item.id}
                className="rounded-xl p-4 mb-3"
                style={{ backgroundColor: colors.backgroundPrimary }}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }}>
                      {item.title}
                    </Text>
                    <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                      {item.body}
                    </Text>
                  </View>
                  <View
                    className="px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: colors.warning + "18" }}
                  >
                    <Text className="text-[11px] font-semibold" style={{ color: colors.warning }}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between mt-3">
                  <View className="flex-row items-center">
                    <BellRing size={14} color={colors.textSecondary} />
                    <Text className="text-xs ml-2" style={{ color: colors.textSecondary }}>
                      {item.audience}
                    </Text>
                  </View>
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    {formatTimestamp(item.createdAt)}
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
