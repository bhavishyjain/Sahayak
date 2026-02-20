import { Mic, Square } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../api/client";
import Card from "../../../components/Card";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";
import { showToast } from "../../../utils/toast";

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout. Please try again.`)), timeoutMs)
    ),
  ]);
}

function isNonSpeechTranscript(text = "") {
  const normalized = String(text).toLowerCase().trim();
  if (!normalized) return true;
  if (/^\[[^\]]+\]$/.test(normalized)) return true;

  return [
    "humming",
    "continuous tone",
    "sound of a tone",
    "noise",
    "background noise",
    "inaudible",
    "silence",
    "no speech",
  ].some((token) => normalized.includes(token));
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const { theme } = usePreferences();
  const { token } = useAuth();
  const colors = useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);

  const tabBarHeight = 74;
  const tabBarBottomOffset = 16;
  const composerBottomOffset = tabBarHeight + tabBarBottomOffset + 28 + insets.bottom;

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(null);

  const [messages, setMessages] = useState([
    { id: "boot", sender: "bot", text: t("chatWelcome") },
  ]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || loading) return;

    if (isNonSpeechTranscript(content)) {
      showToast({
        title: "Could not detect speech",
        message: "Please speak clearly and try again.",
        type: "warning",
      });
      return;
    }

    const userMsg = { id: `${Date.now()}-u`, sender: "user", text: content };
    const conversationHistory = messages.map((m) => ({ sender: m.sender, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await withTimeout(
        api.chatMessage(content, conversationHistory, token),
        30000,
        "Assistant response"
      );

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-b`, sender: "bot", text: result.response || t("chatFallback") },
      ]);
    } catch (_error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-e`, sender: "bot", text: t("chatFallback") },
      ]);
      showToast({
        title: t("failed"),
        message: "Assistant response timeout. Please try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendPresetMessage = async (text) => {
    if (loading) return;
    setInput(text);
    const userMsg = { id: `${Date.now()}-u-preset`, sender: "user", text };
    const conversationHistory = messages.map((m) => ({ sender: m.sender, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const result = await withTimeout(
        api.chatMessage(text, conversationHistory, token),
        15000,
        "Assistant response"
      );
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-b-preset`, sender: "bot", text: result.response || t("chatFallback") },
      ]);
      setInput("");
    } catch (_error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-e-preset`, sender: "bot", text: t("chatFallback") },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoiceCapture = async () => {
    if (loading) return;

    try {
      let av;
      try {
        av = await import("expo-av");
      } catch (_importError) {
        showToast({
          title: "Voice unavailable",
          message: "Install expo-av to enable voice recording.",
          type: "warning",
        });
        return;
      }

      const { Audio } = av;

      if (!recordingRef.current) {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          showToast({
            title: t("permission"),
            message: t("microphonePermissionRequired"),
            type: "warning",
          });
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync({
          android: {
            extension: ".m4a",
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: ".m4a",
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {
            mimeType: "audio/webm",
            bitsPerSecond: 96000,
          },
        });
        await rec.startAsync();
        recordingRef.current = rec;
        setRecording(true);
        return;
      }

      setLoading(true);
      const rec = recordingRef.current;
      await withTimeout(rec.stopAndUnloadAsync(), 10000, "Audio stop");
      recordingRef.current = null;
      setRecording(false);

      const uri = rec.getURI();
      if (!uri) {
        throw new Error("No audio recorded");
      }

      const speech = await withTimeout(
        api.speechToText(uri, token),
        35000,
        "Speech transcription"
      );
      const transcript = (speech?.text || "").trim();

      if (!transcript || isNonSpeechTranscript(transcript)) {
        showToast({
          title: "Could not detect speech",
          message: "Please speak clearly and try again.",
          type: "warning",
        });
        return;
      }

      setInput(transcript);
      inputRef.current?.focus();
      showToast({
        title: "Voice transcribed",
        message: "Review text and tap Send.",
        type: "success",
      });
    } catch (error) {
      setRecording(false);
      recordingRef.current = null;
      showToast({
        title: t("failed"),
        message: error?.message || t("voiceTranscriptionFailed"),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary, paddingHorizontal: 16 }}>
      <Text className="mt-3 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>
        {t("chat")}
      </Text>
      <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
        {t("chatSubtitle")}
      </Text>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 20 }}
          renderItem={({ item }) => {
            const user = item.sender === "user";
            return (
              <View style={{ alignItems: user ? "flex-end" : "flex-start", marginBottom: 10 }}>
                <View
                  style={{
                    maxWidth: "82%",
                    backgroundColor: user ? colors.primary : colors.backgroundSecondary,
                    borderColor: user ? colors.primary : colors.border,
                    borderWidth: 1,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ color: user ? colors.dark : colors.textPrimary, fontWeight: "600" }}>
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <Card style={{ marginBottom: composerBottomOffset, paddingVertical: 18 }}>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            <Pressable
              onPress={() => sendPresetMessage("meri complaint dikhao")}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.backgroundCard,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}>
                Meri complaints
              </Text>
            </Pressable>
            <Pressable
              onPress={() => sendPresetMessage("my latest complaint status")}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.backgroundCard,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "600" }}>
                Latest status
              </Text>
            </Pressable>
          </View>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder={t("chatPlaceholder")}
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 14,
              color: colors.textPrimary,
              marginBottom: 14,
              backgroundColor: colors.backgroundCard,
            }}
            multiline
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={toggleVoiceCapture}
              disabled={loading}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: recording ? colors.danger : colors.border,
                backgroundColor: recording ? "rgba(249,78,78,0.12)" : colors.backgroundSecondary,
              }}
            >
              {recording ? (
                <Square size={20} color={colors.danger} />
              ) : (
                <Mic size={20} color={colors.textPrimary} />
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Pressable
                onPress={sendMessage}
                disabled={loading}
                className={`h-12 items-center justify-center rounded-lg ${loading ? "opacity-60" : ""}`}
                style={{ backgroundColor: colors.primary }}
              >
                <Text style={{ color: colors.dark, fontWeight: "700" }}>{loading ? t("loading") : t("send")}</Text>
              </Pressable>
            </View>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
