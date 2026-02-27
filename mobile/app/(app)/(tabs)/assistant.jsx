import { Send, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import DialogBox from "../../../components/DialogBox";
import PressableBlock from "../../../components/PressableBlock";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { API_BASE } from "../../../url";

export default function Assistant() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi, I am Sahayak. Ask me about your complaints.",
    },
  ]);

  const baseUrl = API_BASE;

  const sendMessage = async () => {
    const msg = text.trim();
    if (!msg || loading) return;

    const nextMessages = [...messages, { role: "user", text: msg }];
    setMessages(nextMessages);
    setText("");

    try {
      setLoading(true);
      const res = await apiCall({
        method: "POST",
        url: `${baseUrl}/chat/message`,
        data: {
          message: msg,
          conversationHistory: nextMessages.map((m) => ({
            role: m.role,
            text: m.text,
          })),
        },
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: res?.data?.response || "No response" },
      ]);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Assistant failed",
        text2: e?.response?.data?.error || "Could not get response.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title="Assistant" hasBackButton={false} />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row justify-end mb-2">
          <PressableBlock
            onPress={() => setShowClearDialog(true)}
            className="rounded-lg px-3 py-2 flex-row items-center"
            style={{ backgroundColor: colors.backgroundSecondary }}
          >
            <Trash2 size={16} color={colors.textSecondary} />
            <Text
              className="ml-2 text-xs font-semibold"
              style={{ color: colors.textSecondary }}
            >
              Clear chat
            </Text>
          </PressableBlock>
        </View>

        {messages.map((m, i) => (
          <Card
            key={`${m.role}-${i}`}
            style={{
              margin: 0,
              marginBottom: 8,
              flex: 0,
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              width: "88%",
              backgroundColor:
                m.role === "user" ? colors.primary : colors.backgroundSecondary,
            }}
          >
            <Text
              style={{
                color: m.role === "user" ? colors.dark : colors.textPrimary,
              }}
            >
              {m.text}
            </Text>
          </Card>
        ))}
      </ScrollView>

      <View
        className="px-4 pb-24 pt-2"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <Card style={{ margin: 0, flex: 0 }}>
          <View
            className="flex-row items-center rounded-xl border px-3 py-2"
            style={{ borderColor: colors.border }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type your message..."
              placeholderTextColor={colors.placeholder}
              className="flex-1"
              style={{ color: colors.textPrimary }}
            />
            <PressableBlock onPress={sendMessage} disabled={loading}>
              <Send size={20} color={loading ? colors.muted : colors.primary} />
            </PressableBlock>
          </View>
        </Card>
      </View>

      <DialogBox
        visible={showClearDialog}
        title="Clear chat"
        message="Are you sure you want to clear all assistant messages?"
        confirmText="Clear"
        cancelText="Cancel"
        onConfirm={() => {
          setShowClearDialog(false);
          setMessages([
            {
              role: "assistant",
              text: "Hi, I am Sahayak. Ask me about your complaints.",
            },
          ]);
        }}
        onCancel={() => setShowClearDialog(false)}
      />
    </View>
  );
}
