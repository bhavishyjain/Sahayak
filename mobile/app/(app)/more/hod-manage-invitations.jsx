import { useFocusEffect, useRouter } from "expo-router";
import {
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  UserPlus,
  RefreshCw,
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

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    color: "#F59E0B",
    Icon: Clock,
  },
  accepted: {
    label: "Accepted",
    color: "#10B981",
    Icon: CheckCircle,
  },
  revoked: {
    label: "Revoked",
    color: "#6B7280",
    Icon: XCircle,
  },
  expired: {
    label: "Expired",
    color: "#EF4444",
    Icon: AlertCircle,
  },
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function InvitationCard({ item, colors, onRevoke }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
  const { Icon } = cfg;
  const canRevoke = item.status === "pending";

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
              {item.email}
            </Text>
            <Text
              className="text-xs mt-0.5"
              style={{ color: colors.textSecondary }}
            >
              Sent {formatDate(item.sentAt)} · Expires {formatDate(item.expiresAt)}
            </Text>
            {item.acceptedAt && (
              <Text
                className="text-xs mt-0.5"
                style={{ color: "#10B981" }}
              >
                Joined {formatDate(item.acceptedAt)}
              </Text>
            )}
          </View>
        </View>

        <View className="items-end">
          <View
            className="px-2 py-0.5 rounded-full mb-2"
            style={{ backgroundColor: cfg.color + "22" }}
          >
            <Text className="text-xs font-semibold" style={{ color: cfg.color }}>
              {cfg.label}
            </Text>
          </View>
          {canRevoke && (
            <TouchableOpacity
              onPress={() => onRevoke(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={16} color={colors.textMuted ?? colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Card>
  );
}

export default function ManageInvitations() {
  const { t } = useTranslation();
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

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await apiCall({ method: "GET", url: HOD_INVITATIONS_URL });
      setInvitations(res?.data?.invitations ?? []);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed to load",
        text2: e?.response?.data?.message ?? "Could not fetch invitations",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, []),
  );

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Toast.show({ type: "error", text1: "Email required" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Toast.show({ type: "error", text1: "Enter a valid email address" });
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
        text1: "Invitation sent",
        text2: `Email sent to ${trimmed}`,
      });
      setEmail("");
      await load(true);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed to send",
        text2: e?.response?.data?.message ?? "Could not send invitation",
      });
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      setRevoking(true);
      await apiCall({
        method: "DELETE",
        url: HOD_REVOKE_INVITATION_URL(revokeTarget.id),
      });
      Toast.show({ type: "success", text1: "Invitation revoked" });
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === revokeTarget.id ? { ...inv, status: "revoked", revokedAt: new Date().toISOString() } : inv,
        ),
      );
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: e?.response?.data?.message ?? "Could not revoke invitation",
      });
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  };

  const pending = invitations.filter((i) => i.status === "pending");
  const others = invitations.filter((i) => i.status !== "pending");

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title="Manage Invitations" onBack={() => router.back()} />

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
          <Card style={{ margin: 0, marginBottom: 20, flex: 0 }}>
            <View className="flex-row items-center mb-3">
              <View
                className="w-9 h-9 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: colors.primary + "20" }}
              >
                <UserPlus size={17} color={colors.primary} />
              </View>
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textPrimary }}
              >
                Invite New Worker
              </Text>
            </View>

            <Text
              className="text-xs mb-3"
              style={{ color: colors.textSecondary }}
            >
              An invitation link valid for 7 days will be sent to the email
              address. The recipient registers as a worker in your department.
            </Text>

            <View
              className="flex-row items-center px-3 py-2 rounded-xl mb-3"
              style={{
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Mail size={18} color={colors.textSecondary} />
              <TextInput
                className="flex-1 ml-2 text-sm"
                style={{ color: colors.textPrimary }}
                placeholder="worker@example.com"
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
              disabled={sending || !email.trim()}
              className="flex-row items-center justify-center py-3 rounded-xl"
              style={{
                backgroundColor:
                  sending || !email.trim()
                    ? colors.border
                    : colors.primary,
              }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Send size={16} color="#fff" />
                  <Text className="text-sm font-semibold text-white ml-2">
                    Send Invitation
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Card>

          {/* Pending invitations */}
          {pending.length > 0 && (
            <>
              <View className="flex-row items-center mb-3">
                <Text
                  className="text-sm font-semibold flex-1"
                  style={{ color: colors.textPrimary }}
                >
                  Pending ({pending.length})
                </Text>
              </View>
              {pending.map((inv) => (
                <InvitationCard
                  key={inv.id}
                  item={inv}
                  colors={colors}
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
                  No pending invitations
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
              <Text
                className="text-sm font-semibold mb-3"
                style={{ color: colors.textSecondary }}
              >
                History ({others.length})
              </Text>
              {others.map((inv) => (
                <InvitationCard
                  key={inv.id}
                  item={inv}
                  colors={colors}
                  onRevoke={setRevokeTarget}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <DialogBox
        visible={!!revokeTarget}
        title="Revoke Invitation"
        message={`Cancel the pending invitation for ${revokeTarget?.email}? They won't be able to register with the invite link.`}
        confirmText={revoking ? "Revoking…" : "Revoke"}
        cancelText="Keep"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </KeyboardAvoidingView>
  );
}
