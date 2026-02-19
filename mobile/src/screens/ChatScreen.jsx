import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import AppButton from "../components/AppButton";
import ScreenShell from "../components/ScreenShell";
import SurfaceCard from "../components/SurfaceCard";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function ChatScreen() {
  const { t } = useTranslation();
  const { theme } = usePreferences();
  const { token } = useAuth();
  const colors = useMemo(() => (theme === "dark" ? darkColors : lightColors), [theme]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const recordingRef = useRef(null);
  const [messages, setMessages] = useState([
    { id: "boot", sender: "bot", text: t("chatWelcome") },
  ]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || loading) return;

    const userMsg = { id: `${Date.now()}-u`, sender: "user", text: content };
    const conversationHistory = messages.map((m) => ({ sender: m.sender, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const result = await api.chatMessage(content, conversationHistory, token);
      if (result?.assistant?.intent === "new_complaint" && result?.assistant?.draft) {
        setPendingDraft(result.assistant.draft);
      } else if (result?.assistant?.intent === "complaint_registered") {
        setPendingDraft(null);
      }
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-b`, sender: "bot", text: result.response || t("chatFallback") },
      ]);
    } catch (_error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-e`, sender: "bot", text: t("chatFallback") },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const registerComplaintFromDraft = async () => {
    if (!pendingDraft || loading) return;

    setLoading(true);
    try {
      const result = await api.chatMessage(
        "",
        messages.map((m) => ({ sender: m.sender, text: m.text })),
        token,
        { action: "registerComplaint", draft: pendingDraft }
      );

      if (result?.assistant?.intent === "complaint_registered") {
        setPendingDraft(null);
      } else if (result?.assistant?.draft) {
        setPendingDraft(result.assistant.draft);
      }

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-b-reg`, sender: "bot", text: result.response || t("chatFallback") },
      ]);
    } catch (_error) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-e-reg`, sender: "bot", text: t("chatRegisterFailed") },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoiceCapture = async () => {
    if (loading) return;

    try {
      const av = await import("expo-av");
      const { Audio } = av;

      if (!recordingRef.current) {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(t("permission"), t("microphonePermissionRequired"));
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await rec.startAsync();
        recordingRef.current = rec;
        setRecording(true);
        return;
      }

      setLoading(true);
      const rec = recordingRef.current;
      await rec.stopAndUnloadAsync();
      recordingRef.current = null;
      setRecording(false);

      const uri = rec.getURI();
      if (!uri) {
        throw new Error("No audio recorded");
      }

      const speech = await api.speechToText(uri, token);
      const transcript = (speech?.text || "").trim();

      if (!transcript) {
        Alert.alert(t("failed"), t("voiceTranscriptionFailed"));
        return;
      }

      setInput(transcript);

      const userMsg = { id: `${Date.now()}-u-voice`, sender: "user", text: transcript };
      const conversationHistory = messages.map((m) => ({ sender: m.sender, text: m.text }));
      setMessages((prev) => [...prev, userMsg]);

      const result = await api.chatMessage(transcript, conversationHistory, token);
      if (result?.assistant?.intent === "new_complaint" && result?.assistant?.draft) {
        setPendingDraft(result.assistant.draft);
      } else if (result?.assistant?.intent === "complaint_registered") {
        setPendingDraft(null);
      }

      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-b-voice`, sender: "bot", text: result.response || t("chatFallback") },
      ]);
      setInput("");
    } catch (_error) {
      setRecording(false);
      recordingRef.current = null;
      Alert.alert(t("failed"), t("voiceTranscriptionFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell scroll={false}>
      <Text className="mt-3 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>{t("chat")}</Text>
      <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>{t("chatSubtitle")}</Text>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 12 }}
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
                  <Text style={{ color: user ? colors.dark : colors.textPrimary, fontWeight: "600" }}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />

        <SurfaceCard className="mb-2">
          {pendingDraft ? (
            <View
              style={{
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 10,
                backgroundColor: colors.backgroundCard,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{t("complaintDraft")}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{pendingDraft.description}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {t("department")}: {pendingDraft.department} | {t("priority")}: {pendingDraft.priority}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {t("location")}: {pendingDraft.locationName || t("locationNeeded")}
              </Text>
              <AppButton
                label={token ? t("registerComplaint") : t("loginToRegister")}
                onPress={registerComplaintFromDraft}
                disabled={!token || loading}
                className="mt-3"
              />
            </View>
          ) : null}
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t("chatPlaceholder")}
            placeholderTextColor={colors.muted}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 12,
              color: colors.textPrimary,
              marginBottom: 10,
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
              <Ionicons
                name={recording ? "stop" : "mic"}
                size={20}
                color={recording ? colors.danger : colors.textPrimary}
              />
            </Pressable>
            <View style={{ flex: 1 }}>
              <AppButton label={loading ? t("loading") : t("send")} onPress={sendMessage} disabled={loading} />
            </View>
          </View>
        </SurfaceCard>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
