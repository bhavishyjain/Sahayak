import { useFocusEffect, useRouter } from "expo-router";
import {
  Mail,
  Send,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  UserPlus,
  RefreshCw,
  ChevronDown,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import DialogBox from "../../../components/DialogBox";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import {
  HOD_INVITE_WORKER_URL,
  HOD_INVITATIONS_URL,
  HOD_REVOKE_INVITATION_URL,
} from "../../../url";

const getStatusConfig = (t, colors) => ({
  pending: {
    label: t("more.manageInvitations.status.pending"),
    color: colors.warning,
    Icon: Clock,
  },
  accepted: {
    label: t("more.manageInvitations.status.accepted"),
    color: colors.success,
    Icon: CheckCircle,
  },
  revoked: {
    label: t("more.manageInvitations.status.revoked"),
    color: colors.textSecondary,
    Icon: XCircle,
  },
  expired: {
    label: t("more.manageInvitations.status.expired"),
    color: colors.danger,
    Icon: AlertCircle,
  },
});

function formatDate(dateStr, locale, t) {
  if (dateStr == null) {
    return t("more.manageInvitations.notAvailable");
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return t("more.manageInvitations.notAvailable");
  }

  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function InvitationCard({ item, colors, t, locale, onRevoke }) {
  const statusConfig = getStatusConfig(t, colors);
  const cfg = statusConfig[item.status] ?? statusConfig.pending;
  const { Icon } = cfg;
  const canRevoke = item.status === "pending";
  const invitationId = item.id ?? item._id;
  const invitationEmail =
    item.email ?? t("more.manageInvitations.emailUnavailable");
  const sentDate = formatDate(item.sentAt, locale, t);
  const expiresDate = formatDate(item.expiresAt, locale, t);
  const acceptedDate = formatDate(item.acceptedAt, locale, t);

  return (
    <Card style={{ margin: 0, marginBottom: 10, flex: 0 }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center flex-1 mr-2">
          <View
            className="w-9 h-9 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: cfg.color + "22" }}
          >
            <Icon size={17} color={cfg.color} />
          </View>
          <View className="flex-1">
            <Text
              className="text-sm font-semibold"
              style={{ color: colors.textPrimary }}
              numberOfLines={1}
            >
              {invitationEmail}
            </Text>
            <View className="mt-0.5">
              <View className="flex-row items-center">
                <Send size={11} color={colors.textSecondary} />
                <Text
                  className="text-xs ml-1"
                  style={{ color: colors.textSecondary }}
                >
                  {t("more.manageInvitations.meta.sent", { date: sentDate })}
                </Text>
              </View>
              {canRevoke && (
                <View className="flex-row items-center mt-1">
                  <Calendar size={11} color={colors.textSecondary} />
                  <Text
                    className="text-xs ml-1"
                    style={{ color: colors.textSecondary }}
                  >
                    {t("more.manageInvitations.meta.expires", {
                      date: expiresDate,
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View className="items-end">
          <View
            className="px-2 py-0.5 rounded-full mb-2"
            style={{ backgroundColor: cfg.color + "22" }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: cfg.color }}
            >
              {cfg.label}
            </Text>
          </View>
          {item.acceptedAt && (
            <Text className="text-xs mb-1" style={{ color: colors.success }}>
              {t("more.manageInvitations.meta.joined", { date: acceptedDate })}
            </Text>
          )}
          {canRevoke && (
            <TouchableOpacity
              onPress={() => onRevoke(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2
                size={16}
                color={colors.muted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Card>
  );
}

export default function ManageInvitations() {
  const { t, locale } = useTranslation();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invitations, setInvitations] = useState([]);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await apiCall({ method: "GET", url: HOD_INVITATIONS_URL });
      setInvitations(res?.data?.invitations ?? []);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("more.manageInvitations.toasts.loadFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("more.manageInvitations.toasts.loadFailedMessage"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [t]),
  );

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Toast.show({
        type: "error",
        text1: t("more.manageInvitations.toasts.emailRequired"),
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Toast.show({
        type: "error",
        text1: t("more.manageInvitations.toasts.invalidEmail"),
      });
      return;
    }

    try {
      setSending(true);
      await apiCall({
        method: "POST",
        url: HOD_INVITE_WORKER_URL,
        data: { email: trimmed },
      });
      Toast.show({
        type: "success",
        text1: t("more.manageInvitations.toasts.sentTitle"),
        text2: t("more.manageInvitations.toasts.sentMessage", {
          email: trimmed,
        }),
      });
      setEmail("");
      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("more.manageInvitations.toasts.sendFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("more.manageInvitations.toasts.sendFailedMessage"),
      });
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      setRevoking(true);
      const targetId = revokeTarget.id ?? revokeTarget._id;
      await apiCall({
        method: "DELETE",
        url: HOD_REVOKE_INVITATION_URL(targetId),
      });
      Toast.show({
        type: "success",
        text1: t("more.manageInvitations.toasts.revokedTitle"),
      });
      setInvitations((prev) =>
        prev.map((inv) =>
          (inv.id ?? inv._id) === targetId
            ? { ...inv, status: "revoked", revokedAt: new Date().toISOString() }
            : inv,
        ),
      );
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("more.manageInvitations.toasts.revokeFailedTitle"),
        text2:
          e?.response?.data?.message ??
          t("more.manageInvitations.toasts.revokeFailedMessage"),
      });
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  };

  const pending = invitations.filter((i) => i.status === "pending");
  const others = invitations.filter((i) => i.status !== "pending");
  const isSendDisabled = sending ? true : email.trim().length === 0;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader
        title={t("more.manageInvitations.title")}
        onBack={() => router.back()}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 60 }}
        >
          {/* Send invitation form */}
          <View className="mb-6">
            <View className="flex-row items-center mb-2">
              <UserPlus size={17} color={colors.primary} />
              <Text
                className="text-base font-semibold ml-2"
                style={{ color: colors.textPrimary }}
              >
                {t("more.manageInvitations.form.title")}
              </Text>
            </View>
            <Text
              className="text-xs mb-5"
              style={{ color: colors.textSecondary }}
            >
              {t("more.manageInvitations.form.description")}
            </Text>

            <View
              className="flex-row items-center px-3 rounded-xl mb-3"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.border,
                height: 48,
              }}
            >
              <Mail size={16} color={colors.textSecondary} />
              <TextInput
                className="flex-1 ml-2 text-sm"
                style={{ color: colors.textPrimary }}
                placeholder={t("more.manageInvitations.form.emailPlaceholder")}
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!sending}
              />
            </View>

            <TouchableOpacity
              onPress={handleSend}
              disabled={isSendDisabled}
              className="flex-row items-center justify-center rounded-xl"
              style={{
                height: 48,
                backgroundColor: isSendDisabled ? colors.border : colors.primary,
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.light} />
              ) : (
                <>
                  <Send size={15} color={colors.light} />
                  <Text
                    className="text-sm font-semibold ml-2"
                    style={{ color: colors.light }}
                  >
                    {t("more.manageInvitations.form.send")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View
            className="h-[1px] mb-5"
            style={{ backgroundColor: colors.border }}
          />

          {/* Pending invitations */}
          {pending.length > 0 && (
            <>
              <View className="flex-row items-center mb-3">
                <Text
                  className="text-sm font-semibold flex-1"
                  style={{ color: colors.textPrimary }}
                >
                  {t("more.manageInvitations.sections.pending", {
                    count: pending.length,
                  })}
                </Text>
              </View>
              {pending.map((inv) => (
                <InvitationCard
                  key={String(inv.id ?? inv._id ?? inv.email)}
                  item={inv}
                  colors={colors}
                  t={t}
                  locale={locale}
                  onRevoke={setRevokeTarget}
                />
              ))}
            </>
          )}

          {pending.length === 0 && (
            <Card style={{ margin: 0, marginBottom: 16, flex: 0 }}>
              <View className="items-center py-6">
                <RefreshCw size={24} color={colors.textSecondary} />
                <Text
                  className="text-sm mt-2"
                  style={{ color: colors.textSecondary }}
                >
                  {t("more.manageInvitations.empty.pending")}
                </Text>
              </View>
            </Card>
          )}

          {/* Past invitations */}
          {others.length > 0 && (
            <>
              <View
                className="h-[1px] my-4"
                style={{ backgroundColor: colors.border }}
              />
              <TouchableOpacity
                onPress={() => setHistoryOpen((o) => !o)}
                className="flex-row items-center mb-3"
                activeOpacity={0.7}
              >
                <Text
                  className="text-sm font-semibold flex-1"
                  style={{ color: colors.textSecondary }}
                >
                  {t("more.manageInvitations.sections.history", {
                    count: others.length,
                  })}
                </Text>
                <View
                  style={{
                    transform: [{ rotate: historyOpen ? "180deg" : "0deg" }],
                  }}
                >
                  <ChevronDown size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
              {historyOpen &&
                others.map((inv) => (
                  <InvitationCard
                    key={String(inv.id ?? inv._id ?? inv.email)}
                    item={inv}
                    colors={colors}
                    t={t}
                    locale={locale}
                    onRevoke={setRevokeTarget}
                  />
                ))}
            </>
          )}
        </ScrollView>
      )}

      <DialogBox
        visible={!!revokeTarget}
        title={t("more.manageInvitations.revokeDialog.title")}
        message={t("more.manageInvitations.revokeDialog.message", {
          email:
            revokeTarget?.email ?? t("more.manageInvitations.emailUnavailable"),
        })}
        confirmText={
          revoking
            ? t("more.manageInvitations.revokeDialog.revoking")
            : t("more.manageInvitations.revokeDialog.confirm")
        }
        cancelText={t("more.manageInvitations.revokeDialog.cancel")}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </KeyboardAvoidingView>
  );
}
