import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  Camera,
  CircleAlert,
  Navigation,
  Languages,
  Mic,
  Send,
  Square,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import AppTextInput from "../../../components/AppTextInput";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import { useTabBarHeight } from "../../../components/CurvedTabBar";
import PressableBlock from "../../../components/PressableBlock";
import { CHAT_SPEECH_TO_TEXT_URL, CHAT_URL } from "../../../url";
import apiCall from "../../../utils/api";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";

function createAudioFormData(uri) {
  const formData = new FormData();
  formData.append("audio", {
    uri,
    name: "assistant-voice.m4a",
    type: "audio/mp4",
  });
  return formData;
}

function createId(prefix = "msg") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const ASSISTANT_HISTORY_KEY = "@sahayak_assistant_history_v1";

function createWelcomeMessage(t) {
  return {
    id: createId("welcome"),
    role: "assistant",
    text: t("assistant.welcomeShort"),
    assistant: { intent: "general" },
  };
}

function createAttachmentMessage({
  t,
  rawMessage,
  coordinates,
  selectedImages,
  messages = [],
}) {
  const trimmed = String(rawMessage || "").trim();
  if (trimmed) return trimmed;

  const pendingRegisterAssistant = [...messages]
    .reverse()
    .find(
      (entry) =>
        entry.role === "assistant" &&
        entry.assistant?.intent === "register_complaint" &&
        Array.isArray(entry.assistant?.missingFields) &&
        entry.assistant.missingFields.length > 0,
    );

  if (pendingRegisterAssistant) {
    const hasCoordinates = Boolean(coordinates);
    const hasImages = selectedImages.length > 0;

    if (hasCoordinates && hasImages) {
      return t("assistant.continueWithCoordinatesAndImages");
    }
    if (hasCoordinates) {
      return t("assistant.continueWithCoordinates");
    }
    if (hasImages) {
      return t("assistant.continueWithImages");
    }
  }

  const parts = [];
  if (coordinates) {
    parts.push(`${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`);
  }
  if (selectedImages.length > 0) {
    parts.push(t("assistant.attachedProofImages", {
      count: selectedImages.length,
      suffix: selectedImages.length > 1 ? "s" : "",
    }));
  }

  if (parts.length > 0) {
    return parts.join(" • ");
  }

  return "";
}

function getUiCopy(t) {
  return {
    transcriptReady: t("assistant.transcriptReady"),
    transcriptLabel: t("assistant.transcriptLabel"),
    recentSection: t("assistant.recentSection"),
    openComplaint: t("assistant.openComplaint"),
    pendingLocation: t("assistant.pendingLocation"),
    pendingDetails: t("assistant.pendingDetails"),
    you: t("common.you"),
    assistant: t("assistant.title"),
  };
}

function getStatusTone(status, colors) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "resolved") return colors.success;
  if (normalized === "in-progress" || normalized === "assigned") {
    return colors.warning;
  }
  if (normalized === "cancelled") return colors.muted;
  return colors.primary;
}

function ComplaintCardMessage({ complaint, colors, label, onOpen }) {
  if (!complaint) return null;

  return (
    <Card
      style={{
        margin: 0,
        marginTop: 10,
        flex: 0,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundPrimary,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text
            className="text-xs uppercase"
            style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
          >
            {complaint.ticketId}
          </Text>
          <Text
            className="mt-1 text-base font-semibold"
            style={{ color: colors.textPrimary }}
          >
            {complaint.title || complaint.description}
          </Text>
          {complaint.description ? (
            <Text
              className="mt-2 text-sm"
              style={{ color: colors.textSecondary, lineHeight: 20 }}
            >
              {complaint.description}
            </Text>
          ) : null}
        </View>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: `${getStatusTone(complaint.status, colors)}22` }}
        >
          <Text style={{ color: getStatusTone(complaint.status, colors) }}>
            {complaint.status}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row flex-wrap">
        {[
          complaint.department,
          complaint.priority,
          complaint.locationName,
        ]
          .filter(Boolean)
          .map((item) => (
            <View
              key={item}
              className="mr-2 mt-2 rounded-full px-3 py-1"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <Text className="text-xs" style={{ color: colors.textSecondary }}>
                {item}
              </Text>
            </View>
          ))}
      </View>

      {onOpen ? (
        <PressableBlock
          onPress={() => onOpen(complaint)}
          className="mt-4 rounded-xl px-4 py-3"
          style={{ backgroundColor: colors.backgroundSecondary }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
            {label}
          </Text>
        </PressableBlock>
      ) : null}
    </Card>
  );
}

function MessageImageStrip({ images = [], onOpenImage, onRemoveImage, colors }) {
  if (!Array.isArray(images) || images.length === 0) return null;

  return (
    <View className="mt-3 flex-row flex-wrap">
      {images.map((image, index) => {
        const uri = typeof image === "string" ? image : image?.uri;
        if (!uri) return null;

        return (
          <View key={`${uri}-${index}`} className="mr-2 mb-2 relative">
            <PressableBlock onPress={() => onOpenImage?.(uri)}>
              <Image
                source={{ uri }}
                style={{ width: 56, height: 56, borderRadius: 14 }}
              />
            </PressableBlock>
            {onRemoveImage ? (
              <PressableBlock
                onPress={() => onRemoveImage(index)}
                className="absolute -right-1 -top-1 rounded-full p-1"
                style={{ backgroundColor: colors.danger }}
              >
                <X size={12} color="#FFFFFF" />
              </PressableBlock>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default function Assistant() {
  const { t, locale } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const router = useRouter();
  const scrollRef = useRef(null);
  const recordingStartedAtRef = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const ui = useMemo(() => getUiCopy(t), [t]);

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [detectedSpeechLanguage, setDetectedSpeechLanguage] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [coordinates, setCoordinates] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [messages, setMessages] = useState([]);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [composerHeight, setComposerHeight] = useState(120);

  useEffect(() => {
    return () => {
      recorder.stop().catch(() => {});
    };
  }, [recorder]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const raw =
          Platform.OS === "web"
            ? localStorage.getItem(ASSISTANT_HISTORY_KEY)
            : await AsyncStorage.getItem(ASSISTANT_HISTORY_KEY);
        if (cancelled) return;

        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            setHistoryHydrated(true);
            return;
          }
        }
      } catch (_error) {
      }

      if (!cancelled) {
        setMessages([createWelcomeMessage(t)]);
        setHistoryHydrated(true);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [locale, t]);

  useEffect(() => {
    if (!historyHydrated || messages.length === 0) return;

    const serialized = JSON.stringify(messages);
    if (Platform.OS === "web") {
      localStorage.setItem(ASSISTANT_HISTORY_KEY, serialized);
      return;
    }

    AsyncStorage.setItem(ASSISTANT_HISTORY_KEY, serialized).catch(() => {});
  }, [historyHydrated, messages]);

  useEffect(() => {
    if (!historyHydrated) return;
    setMessages((prev) => {
      if (prev.length === 0) {
        return [createWelcomeMessage(t)];
      }

      return prev.map((message, index) => {
        if (index !== 0 || message.role !== "assistant") return message;
        if (message.assistant?.intent !== "general") return message;
        return {
          ...message,
          text: createWelcomeMessage(t).text,
          assistant: { ...(message.assistant || {}), language: locale },
        };
      });
    });
  }, [historyHydrated, locale, t]);

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

  const busy = loading || voiceLoading;
  const hasPendingAttachment = Boolean(coordinates) || selectedImages.length > 0;
  const tabBarSpacing =
    Math.max(insets.bottom, 8) + Math.max(24, tabBarHeight - 28);
  const activeComposerBottom = keyboardHeight
    ? Math.max(12, keyboardHeight - insets.bottom)
    : tabBarSpacing;

  const helperHint = useMemo(
    () => t("assistant.detailsHint"),
    [t],
  );

  async function submitMessage(rawMessage = text, options = {}) {
    const pendingCoordinates = coordinates ? { ...coordinates } : null;
    const pendingImages = selectedImages.map((image) => ({ ...image }));
    const msg = createAttachmentMessage({
      t,
      rawMessage,
      coordinates: pendingCoordinates,
      selectedImages: pendingImages,
      messages,
    });
    if (!msg || busy) return;

    const userMessage = {
      id: createId("user"),
      role: "user",
      text: msg,
      attachments: {
        coordinates: pendingCoordinates,
        images: pendingImages.map((image) => image.uri).filter(Boolean),
      },
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    if (options.clearInput !== false) {
      setText("");
    }
    setSelectedImages([]);
    setCoordinates(null);

    try {
      setLoading(true);
      const conversationPayload = nextMessages.slice(-12).map((item) => ({
        role: item.role,
        text: item.text,
        assistant: item.assistant,
      }));

      const hasAttachments =
        Boolean(pendingCoordinates) || pendingImages.length > 0;
      const requestConfig = hasAttachments
        ? (() => {
            const formData = new FormData();
            formData.append("message", msg);
            formData.append(
              "conversationHistory",
              JSON.stringify(conversationPayload),
            );
            if (pendingCoordinates) {
              formData.append("coordinates", JSON.stringify(pendingCoordinates));
            }
            pendingImages.forEach((image) => {
              const uri = image.uri;
              const filename = uri.split("/").pop() || `assistant-${Date.now()}.jpg`;
              const match = /\.([\w]+)$/.exec(filename);
              const type = match ? `image/${match[1]}` : "image/jpeg";
              formData.append("images", {
                uri,
                name: filename,
                type,
              });
            });
            return {
              method: "POST",
              url: `${CHAT_URL}/message`,
              data: formData,
              headers: {
                "Content-Type": "multipart/form-data",
              },
            };
          })()
        : {
            method: "POST",
            url: `${CHAT_URL}/message`,
            data: {
              message: msg,
              conversationHistory: conversationPayload,
            },
          };

      const res = await apiCall(requestConfig);

      const payload = res?.data || {};
      const assistantMeta = payload.assistant || {};
      setMessages((prev) => [
        ...prev,
        {
          id: createId("assistant"),
          role: "assistant",
          text:
            String(payload.response || "").trim() || t("assistant.noResponse"),
          assistant: assistantMeta,
        },
      ]);
    } catch (error) {
      setSelectedImages(pendingImages);
      setCoordinates(pendingCoordinates);
      const status = error?.response?.status;
      const messageText =
        error?.response?.data?.error || t("assistant.errorResponse");

      if (status === 401 || status === 403) {
        setMessages((prev) => [
          ...prev,
          {
            id: createId("assistant"),
            role: "assistant",
            text: messageText,
            assistant: { intent: "error", language: locale },
          },
        ]);
        return;
      }

      Toast.show({
        type: "error",
        text1: t(
          "assistant.assistantFailed",
        ),
        text2: messageText,
      });
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    if (busy || isRecording) return;

    try {
      let permission = await getRecordingPermissionsAsync();
      if (!permission?.granted && permission?.canAskAgain !== false) {
        permission = await requestRecordingPermissionsAsync();
      }

      if (!permission?.granted) {
        if (permission?.canAskAgain === false) {
          Alert.alert(
            t(
              "assistant.voicePermissionTitle",
            ),
            t("assistant.voicePermissionSettingsMessage"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("assistant.openSettings"),
                onPress: () => Linking.openSettings(),
              },
            ],
          );
          return;
        }

        Toast.show({
          type: "error",
          text1: t(
            "assistant.voicePermissionTitle",
          ),
          text2: t("assistant.voicePermissionMessage"),
        });
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: t(
          "assistant.voiceFailed",
        ),
        text2: error?.message || helperHint,
      });
    }
  }

  async function stopRecordingAndTranscribe() {
    if (!isRecording) return;

    try {
      setVoiceLoading(true);
      await recorder.stop();
      const durationMs = recordingStartedAtRef.current
        ? Date.now() - recordingStartedAtRef.current
        : 0;
      recordingStartedAtRef.current = 0;
      const uri = recorder.uri;
      setIsRecording(false);

      if (durationMs < 800) {
        Toast.show({
          type: "info",
          text1: t("assistant.speakLonger"),
          text2: t("assistant.speakLongerMessage"),
        });
        return;
      }

      if (!uri) {
        throw new Error("Missing audio URI");
      }

      const response = await apiCall({
        method: "POST",
        url: CHAT_SPEECH_TO_TEXT_URL,
        data: createAudioFormData(uri),
        suppressErrorLog: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const transcript = String(response?.data?.text || "").trim();
      if (!transcript) {
        Toast.show({
          type: "info",
          text1: t(
            "assistant.noResponse",
          ),
          text2: helperHint,
        });
        return;
      }

      setDetectedSpeechLanguage(String(response?.data?.language || "").trim());
      setText((prev) => {
        const prefix = prev.trim();
        return prefix ? `${prefix} ${transcript}` : transcript;
      });
    } catch (error) {
      setIsRecording(false);
      const status = error?.response?.status;
      if (status === 422) {
        Toast.show({
          type: "info",
          text1: t("assistant.noSpeechDetected"),
          text2: t("assistant.noSpeechDetectedMessage"),
        });
        return;
      }

      Toast.show({
        type: "error",
        text1: t(
          "assistant.voiceFailed",
        ),
        text2: error?.response?.data?.error || t("assistant.errorResponse"),
      });
    } finally {
      setVoiceLoading(false);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }

  async function captureCurrentLocation() {
    try {
      setFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: t("assistant.permissionRequired"),
          text2: t("assistant.locationPermissionMessage"),
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 15000,
      });

      setCoordinates({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });

      Toast.show({
        type: "success",
        text1: t("assistant.locationCaptured"),
        text2: `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`,
      });
    } catch (_error) {
      Toast.show({
        type: "error",
        text1: t("assistant.locationCaptureFailed"),
        text2: t("assistant.tryAgain"),
      });
    } finally {
      setFetchingLocation(false);
    }
  }

  async function takeProofPhoto() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Toast.show({
          type: "error",
          text1: t("assistant.permissionRequired"),
          text2: t("assistant.photoPermissionMessage"),
        });
        return;
      }

      if (selectedImages.length >= 5) {
        Toast.show({
          type: "info",
          text1: t("assistant.maximumReached"),
          text2: t("assistant.maxImagesMessage"),
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets?.length) {
        setSelectedImages((prev) => [...prev, ...result.assets].slice(0, 5));
      }
    } catch (_error) {
      Toast.show({
        type: "error",
        text1: t("assistant.photoCaptureFailed"),
        text2: t("assistant.tryAgain"),
      });
    }
  }

  function removeImage(index) {
    setSelectedImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  }

  function openImagePreview(uri) {
    if (!uri) return;
    setPreviewImageUri(uri);
  }

  function openComplaint(complaint) {
    if (!complaint?.id) return;
    router.push({
      pathname: "/(app)/complaints/complaint-details",
      params: { id: complaint.id },
    });
  }

  function renderStructuredContent(message) {
    const assistant = message.assistant || {};

    if (assistant?.complaint) {
      return (
        <ComplaintCardMessage
          complaint={assistant.complaint}
          colors={colors}
          label={ui.openComplaint}
          onOpen={openComplaint}
        />
      );
    }

    if (Array.isArray(assistant?.complaints) && assistant.complaints.length > 0) {
      return (
        <View className="mt-3">
          <Text
            className="mb-2 text-xs uppercase"
            style={{ color: colors.textSecondary, letterSpacing: 0.8 }}
          >
            {ui.recentSection}
          </Text>
          {assistant.complaints.map((complaint) => (
            <ComplaintCardMessage
              key={complaint.id || complaint.ticketId}
              complaint={complaint}
              colors={colors}
              label={ui.openComplaint}
              onOpen={openComplaint}
            />
          ))}
        </View>
      );
    }

    if (
      assistant?.intent === "register_complaint" &&
      Array.isArray(assistant?.missingFields) &&
      assistant.missingFields.length > 0
    ) {
      const needsCoordinates = assistant.missingFields.includes("coordinates");
      const needsImages = assistant.missingFields.includes("images");
      return (
        <View className="mt-3">
          <View
            className="flex-row items-center rounded-2xl px-3 py-3"
            style={{ backgroundColor: `${colors.warning}18` }}
          >
            <CircleAlert size={16} color={colors.warning} />
            <Text className="ml-2 flex-1" style={{ color: colors.textPrimary }}>
              {needsCoordinates
                ? needsImages
                  ? t("assistant.needLocationAndImages")
                  : t("assistant.needLocationOnly")
                : needsImages
                  ? t("assistant.needImagesOnly")
                  : assistant.missingFields.includes("locationName")
                    ? ui.pendingLocation
                    : ui.pendingDetails}
            </Text>
          </View>

          {(needsCoordinates || needsImages) ? (
            <View className="mt-3">
              <View className="flex-row flex-wrap">
                {needsCoordinates ? (
                  <PressableBlock
                    onPress={captureCurrentLocation}
                    disabled={busy || fetchingLocation}
                    className="mr-2 mb-2 flex-row items-center rounded-full border px-3 py-2"
                    style={{
                      borderColor: coordinates ? colors.primary : colors.border,
                      backgroundColor: coordinates
                        ? `${colors.primary}18`
                        : colors.backgroundPrimary,
                    }}
                  >
                    {fetchingLocation ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Navigation
                          size={16}
                          color={
                            coordinates ? colors.primary : colors.textSecondary
                          }
                        />
                        <Text
                          className="ml-2 text-xs font-semibold"
                          style={{
                            color: coordinates
                              ? colors.primary
                              : colors.textPrimary,
                          }}
                        >
                          {coordinates
                            ? `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`
                            : t("assistant.captureLocationAction")}
                        </Text>
                      </>
                    )}
                  </PressableBlock>
                ) : null}

                {needsImages ? (
                  <PressableBlock
                    onPress={takeProofPhoto}
                    disabled={busy || selectedImages.length >= 5}
                    className="mb-2 flex-row items-center rounded-full border px-3 py-2"
                    style={{
                      borderColor:
                        selectedImages.length > 0 ? colors.primary : colors.border,
                      backgroundColor:
                        selectedImages.length > 0
                          ? `${colors.primary}18`
                          : colors.backgroundPrimary,
                    }}
                  >
                    <Camera
                      size={16}
                      color={
                        selectedImages.length > 0
                          ? colors.primary
                          : colors.textSecondary
                      }
                    />
                    <Text
                      className="ml-2 text-xs font-semibold"
                      style={{
                        color:
                          selectedImages.length > 0
                            ? colors.primary
                            : colors.textPrimary,
                      }}
                    >
                      {t("assistant.photosCount", { count: selectedImages.length })}
                    </Text>
                  </PressableBlock>
                ) : null}
              </View>

            </View>
          ) : null}
        </View>
      );
    }

    return null;
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
      <BackButtonHeader title={t("assistant.title")} hasBackButton={false} />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {!historyHydrated ? null : (
        <View className="flex-1">
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerStyle={{
              padding: 16,
              paddingBottom: activeComposerBottom + composerHeight + 48,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            <Card
              style={{
                margin: 0,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.backgroundSecondary,
              }}
            >
              <Text
                className="text-xs"
                style={{ color: colors.textSecondary, lineHeight: 18 }}
              >
                {helperHint}
              </Text>
            </Card>

            {detectedSpeechLanguage ? (
              <Card
                style={{
                  margin: 0,
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                <View className="flex-row items-center">
                  <Languages size={18} color={colors.primary} />
                  <View className="ml-3 flex-1">
                    <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                      {ui.transcriptReady}
                    </Text>
                    <Text className="mt-1" style={{ color: colors.textSecondary }}>
                      {ui.transcriptLabel}: {detectedSpeechLanguage.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            <View className="mt-4">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <Card
                    key={message.id}
                    style={{
                      margin: 0,
                      marginBottom: 10,
                      flex: 0,
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      width: "92%",
                      borderWidth: isUser ? 0 : 1,
                      borderColor: colors.border,
                      backgroundColor: isUser
                        ? colors.primary
                        : colors.backgroundSecondary,
                    }}
                  >
                    <Text
                      className="mb-2 text-[11px] uppercase"
                      style={{
                        color: isUser ? colors.dark : colors.textSecondary,
                        letterSpacing: 0.8,
                      }}
                    >
                      {isUser ? ui.you : ui.assistant}
                    </Text>
                    <Text
                      style={{
                        color: isUser ? colors.dark : colors.textPrimary,
                        lineHeight: 21,
                      }}
                    >
                      {message.text}
                    </Text>
                    {isUser && message.attachments?.images?.length ? (
                      <MessageImageStrip
                        images={message.attachments.images}
                        onOpenImage={openImagePreview}
                        colors={colors}
                      />
                    ) : null}
                    {!isUser ? renderStructuredContent(message) : null}
                  </Card>
                );
              })}

              {loading ? (
                <Card
                  style={{
                    margin: 0,
                    width: "62%",
                    flex: 0,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                  }}
                >
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text className="ml-2" style={{ color: colors.textSecondary }}>
                      {t("assistant.thinking")}
                    </Text>
                  </View>
                </Card>
              ) : null}
            </View>
          </ScrollView>

          <View
            className="absolute left-0 right-0 px-4 pt-2"
            onLayout={(event) => {
              setComposerHeight(event.nativeEvent.layout.height);
            }}
            style={{
              bottom: activeComposerBottom,
              backgroundColor: colors.backgroundPrimary,
            }}
          >
            <Card
              style={{
                margin: 0,
                flex: 0,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {selectedImages.length > 0 ? (
                <MessageImageStrip
                  images={selectedImages}
                  onOpenImage={openImagePreview}
                  onRemoveImage={removeImage}
                  colors={colors}
                />
              ) : null}

              <View
                className="flex-row items-end rounded-2xl border px-3 py-2"
                style={{ borderColor: colors.border }}
              >
                <PressableBlock
                  onPress={takeProofPhoto}
                  disabled={busy || selectedImages.length >= 5}
                  className="mr-2 mb-1 rounded-full p-2"
                  style={{ backgroundColor: `${colors.primary}18` }}
                >
                  <Camera size={20} color={colors.primary} />
                </PressableBlock>

                <AppTextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={t("assistant.inputPlaceholder")}
                  editable={!busy}
                  multiline
                  containerStyle={{ flex: 1 }}
                  inputContainerStyle={{
                    minHeight: 44,
                    maxHeight: 120,
                    borderWidth: 0,
                    backgroundColor: "transparent",
                  }}
                  inputStyle={{
                    minHeight: 44,
                    maxHeight: 120,
                    paddingTop: 8,
                  }}
                />

                <PressableBlock
                  onPress={
                    isRecording ? stopRecordingAndTranscribe : startRecording
                  }
                  disabled={loading || voiceLoading}
                  className="mr-2 mb-1 rounded-full p-2"
                  style={{
                    backgroundColor: isRecording
                      ? `${colors.danger}22`
                      : `${colors.primary}18`,
                  }}
                >
                  {voiceLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : isRecording ? (
                    <Square size={20} color={colors.danger} />
                  ) : (
                    <Mic size={20} color={colors.primary} />
                  )}
                </PressableBlock>

                <PressableBlock
                  onPress={() => submitMessage()}
                  disabled={busy || (!text.trim() && !hasPendingAttachment)}
                  className="ml-2 mb-1 rounded-full p-2"
                  style={{ backgroundColor: `${colors.primary}18` }}
                >
                  <Send
                    size={20}
                    color={
                      busy || (!text.trim() && !hasPendingAttachment)
                        ? colors.muted
                        : colors.primary
                    }
                  />
                </PressableBlock>
              </View>
            </Card>
          </View>
        </View>
        )}
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(previewImageUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri("")}
      >
        <View
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.88)" }}
        >
          <PressableBlock
            onPress={() => setPreviewImageUri("")}
            className="absolute right-5 top-16 z-10 rounded-full p-3"
            style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
          >
            <X size={20} color="#FFFFFF" />
          </PressableBlock>

          {previewImageUri ? (
            <Image
              source={{ uri: previewImageUri }}
              resizeMode="contain"
              style={{ width: "100%", height: "78%" }}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
