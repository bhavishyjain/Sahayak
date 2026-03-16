import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  BarChart2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  HardHat,
  Lock,
  Mail,
  Phone,
  Smartphone,
  Trophy,
  User,
} from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import apiCall from "../../../utils/api";
import {
  getPasswordStrengthMessage,
  isStrongPassword,
} from "../../../utils/passwordStrength";
import { useTheme } from "../../../utils/context/theme";
import getUserAuth, { setUserAuth } from "../../../utils/userAuth";
import { ACCEPT_INVITE_URL, REGISTER_URL } from "../../../url";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";

const BENEFITS = [
  { Icon: ClipboardList, key: "manageAssignments" },
  { Icon: Smartphone, key: "updateStatus" },
  { Icon: BarChart2, key: "trackMetrics" },
  { Icon: Trophy, key: "leaderboard" },
];

export default function AcceptInvite() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();

  const token = params.token ? decodeURIComponent(String(params.token)) : "";
  const invitedEmail = params.email
    ? decodeURIComponent(String(params.email))
    : "";
  const department = params.department
    ? decodeURIComponent(String(params.department))
    : "";

  const [loggedInUser, setLoggedInUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);

  // Registration form state (used only when not logged in)
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);

  useEffect(() => {
    (async () => {
      const user = await getUserAuth();
      setLoggedInUser(user);
      setCheckingAuth(false);
    })();
  }, []);

  const inputTheme = {
    colors: {
      primary: colors.primary,
      onSurfaceVariant: colors.placeholder,
      surface: colors.backgroundSecondary,
      onSurface: colors.textPrimary,
      outline: colors.border,
    },
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <SafeAreaView
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // ── Invalid link ─────────────────────────────────────────────────────────
  if (!token || !department) {
    return (
      <SafeAreaView
        className="flex-1 justify-center items-center px-6"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <AlertCircle size={64} color={colors.danger} />
        <Text
          className="text-2xl font-bold mt-4 mb-2 text-center"
          style={{ color: colors.textPrimary }}
        >
          {t("auth.acceptInvite.invalidTitle")}
        </Text>
        <Text
          className="text-sm text-center leading-6 mb-8"
          style={{ color: colors.textSecondary }}
        >
          {t("auth.acceptInvite.invalidMessage")}
        </Text>
        <TouchableOpacity
          className="rounded-xl px-8 py-4"
          style={{ backgroundColor: colors.primary }}
          onPress={() => router.replace("/(app)/(tabs)/home")}
        >
          <Text className="text-white font-bold text-base">{t("auth.acceptInvite.goToHome")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── LOGGED IN FLOW ──────────────────────────────────────────────────────
  if (loggedInUser) {
    const handleAccept = async () => {
      setLoading(true);
      try {
        const res = await apiCall({
          method: "POST",
          url: ACCEPT_INVITE_URL,
          data: { inviteToken: token },
        });
        const { token: newJwt, user: updatedUser } = res.data || {};
        if (newJwt && updatedUser) {
          await setUserAuth({ ...updatedUser, auth_token: newJwt, token: newJwt });
        }
        Toast.show({ type: "success", text1: t("auth.acceptInvite.toast.welcomeTitle"), text2: `${t("auth.acceptInvite.toast.welcomeMessage")} ${department}` });
        router.replace("/(app)/(tabs)/worker-home");
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || t("auth.acceptInvite.toast.acceptFailed");
        Toast.show({ type: "error", text1: t("auth.acceptInvite.toast.acceptFailedTitle"), text2: msg });
      } finally {
        setLoading(false);
      }
    };

    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View className="flex-row items-center gap-3 mb-6">
            <TouchableOpacity onPress={() => router.back()} hitSlop={16} className="p-1">
              <ArrowLeft size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>{t("auth.acceptInvite.workerInvitationTitle")}</Text>
          </View>

          {/* Hero */}
          <View className="items-center mb-6">
            <View
              className="w-24 h-24 rounded-full justify-center items-center mb-4"
              style={{ backgroundColor: colors.backgroundSecondary, borderWidth: 2, borderColor: colors.primary }}
            >
              <HardHat size={48} color={colors.primary} />
            </View>
            <Text className="text-3xl font-extrabold mb-1" style={{ color: colors.textPrimary }}>{t("auth.acceptInvite.youreInvited")}</Text>
            <Text className="text-base font-semibold mb-3" style={{ color: colors.primary }}>{department} {t("auth.acceptInvite.departmentLabel")}</Text>
            <View
              className="flex-row items-center gap-2 rounded-full px-4 py-2 max-w-xs"
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <Mail size={14} color={colors.textSecondary} />
              <Text className="text-sm" style={{ color: colors.textSecondary }} numberOfLines={1}>
                {invitedEmail || loggedInUser.email}
              </Text>
            </View>
          </View>

          {/* Info card */}
          <View
            className="rounded-xl p-4 mb-4"
            style={{ backgroundColor: colors.backgroundSecondary, borderLeftWidth: 4, borderLeftColor: colors.primary }}
          >
            <Text className="text-sm leading-6" style={{ color: colors.textPrimary }}>
              {t("auth.acceptInvite.hodInviteMessage")}
            </Text>
          </View>

          {/* Benefits */}
          <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.backgroundSecondary }}>
            <Text className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: colors.textSecondary }}>
              {t("auth.acceptInvite.benefitsTitle")}
            </Text>
            {BENEFITS.map(({ Icon, key }, i) => (
              <View key={i} className="flex-row items-center gap-3 mb-3">
                <View
                  className="w-9 h-9 rounded-lg justify-center items-center"
                  style={{ backgroundColor: colors.backgroundPrimary }}
                >
                  <Icon size={18} color={colors.primary} />
                </View>
                <Text className="flex-1 text-sm leading-5" style={{ color: colors.textPrimary }}>{t(`auth.acceptInvite.benefits.${key}`)}</Text>
              </View>
            ))}
          </View>

          {/* Expiry warning */}
          <View
            className="flex-row items-center gap-3 rounded-xl p-4 mb-6"
            style={{ backgroundColor: colors.backgroundSecondary, borderLeftWidth: 4, borderLeftColor: colors.warning }}
          >
            <Clock size={18} color={colors.warning} />
            <Text className="flex-1 text-sm leading-5" style={{ color: colors.warning }}>
              {t("auth.acceptInvite.expiryWarning")}
            </Text>
          </View>

          {/* Accept button */}
          <TouchableOpacity
            className="flex-row justify-center items-center rounded-2xl py-4 mb-4"
            style={{ backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }}
            onPress={handleAccept}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <CheckCircle2 size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text className="text-white text-base font-bold">{t("auth.acceptInvite.acceptButton")}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity className="items-center py-3" onPress={() => router.replace("/(app)/(tabs)/home")}>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>{t("auth.acceptInvite.decline")}</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── NOT LOGGED IN FLOW — Register as Worker ───────────────────────────────
  const handleRegister = async () => {
    if (!fullName.trim()) return Toast.show({ type: "error", text1: t("auth.acceptInvite.toast.fullNameRequired") });
    if (!username.trim()) return Toast.show({ type: "error", text1: t("auth.acceptInvite.toast.usernameRequired") });
    if (!phone.trim())    return Toast.show({ type: "error", text1: t("auth.acceptInvite.toast.phoneRequired") });
    if (!isStrongPassword(password)) {
      return Toast.show({
        type: "error",
        text1: t("auth.passwordStrength.title"),
        text2: getPasswordStrengthMessage(t),
      });
    }

    setLoading(true);
    try {
      const res = await apiCall({
        method: "POST",
        url: REGISTER_URL,
        data: {
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          email: invitedEmail.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          inviteToken: token,
        },
      });
      const { token: newJwt, user: userData } = res.data || {};
      if (newJwt && userData) {
        await setUserAuth({ ...userData, auth_token: newJwt, token: newJwt });
      }
      Toast.show({ type: "success", text1: t("auth.acceptInvite.toast.accountCreatedTitle"), text2: `${t("auth.acceptInvite.toast.accountCreatedMessage")} ${department}` });
      router.replace("/(app)/(tabs)/worker-home");
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || t("auth.acceptInvite.toast.registerFailed");
      Toast.show({ type: "error", text1: t("auth.acceptInvite.toast.registerFailedTitle"), text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.backgroundPrimary }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center gap-3 mb-6">
            <TouchableOpacity onPress={() => router.back()} hitSlop={16} className="p-1">
              <ArrowLeft size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text className="text-xl font-bold" style={{ color: colors.textPrimary }}>{t("auth.acceptInvite.workerRegistrationTitle")}</Text>
          </View>

          {/* Hero */}
          <View className="items-center mb-4">
            <View
              className="w-24 h-24 rounded-full justify-center items-center mb-4"
              style={{ backgroundColor: colors.backgroundSecondary, borderWidth: 2, borderColor: colors.primary }}
            >
              <HardHat size={48} color={colors.primary} />
            </View>
            <Text className="text-3xl font-extrabold mb-1" style={{ color: colors.textPrimary }}>{t("auth.acceptInvite.joinAsWorker")}</Text>
            <Text className="text-base font-semibold" style={{ color: colors.primary }}>{department} {t("auth.acceptInvite.departmentLabel")}</Text>
          </View>

          <Text className="text-sm text-center mb-6 leading-5" style={{ color: colors.textSecondary }}>
            {t("auth.acceptInvite.createAccountTo")}{" "}
            <Text className="font-bold" style={{ color: colors.primary }}>{department}</Text>
            {" "}{t("auth.acceptInvite.asAWorker")}
          </Text>

          {/* Form */}
          <View className="gap-3 mb-6">
            <PaperTextInput
              label={t("auth.acceptInvite.form.fullName")}
              value={fullName}
              onChangeText={setFullName}
              mode="outlined"
              style={{ backgroundColor: colors.backgroundSecondary }}
              theme={inputTheme}
              textColor={colors.textPrimary}
              left={<PaperTextInput.Icon icon={() => <User size={18} color={colors.placeholder} />} />}
            />
            <PaperTextInput
              label={t("auth.acceptInvite.form.username")}
              value={username}
              onChangeText={(v) => setUsername(v.replace(/\s/g, "").toLowerCase())}
              mode="outlined"
              style={{ backgroundColor: colors.backgroundSecondary }}
              theme={inputTheme}
              textColor={colors.textPrimary}
              autoCapitalize="none"
              left={<PaperTextInput.Icon icon={() => <AtSign size={18} color={colors.placeholder} />} />}
            />
            <PaperTextInput
              label={t("auth.acceptInvite.form.emailFromInvite")}
              value={invitedEmail}
              mode="outlined"
              style={{ backgroundColor: colors.backgroundSecondary }}
              theme={inputTheme}
              textColor={colors.textSecondary}
              editable={false}
              left={<PaperTextInput.Icon icon={() => <Mail size={18} color={colors.placeholder} />} />}
              right={<PaperTextInput.Icon icon={() => <Lock size={18} color={colors.placeholder} />} />}
            />
            <PaperTextInput
              label={t("auth.acceptInvite.form.phone")}
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              style={{ backgroundColor: colors.backgroundSecondary }}
              theme={inputTheme}
              textColor={colors.textPrimary}
              keyboardType="phone-pad"
              left={<PaperTextInput.Icon icon={() => <Phone size={18} color={colors.placeholder} />} />}
            />
            <PaperTextInput
              label={t("auth.acceptInvite.form.password")}
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={{ backgroundColor: colors.backgroundSecondary }}
              theme={inputTheme}
              textColor={colors.textPrimary}
              secureTextEntry={secure}
              left={<PaperTextInput.Icon icon={() => <Lock size={18} color={colors.placeholder} />} />}
              right={
                <PaperTextInput.Icon
                  icon={() => secure ? <Eye size={18} color={colors.placeholder} /> : <EyeOff size={18} color={colors.placeholder} />}
                  onPress={() => setSecure((v) => !v)}
                />
              }
            />
            <Text
              className="text-xs mt-1"
              style={{ color: colors.textSecondary }}
            >
              {getPasswordStrengthMessage(t)}
            </Text>
          </View>

          {/* Register button */}
          <TouchableOpacity
            className="flex-row justify-center items-center rounded-2xl py-4 mb-4"
            style={{ backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <HardHat size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text className="text-white text-base font-bold">{t("auth.acceptInvite.registerButton")}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity className="items-center py-3" onPress={() => router.replace("/(app)/(auth)/login")}>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              {t("auth.acceptInvite.alreadyHaveAccount")}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
