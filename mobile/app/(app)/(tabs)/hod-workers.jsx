import { useRouter } from "expo-router";
import {
  User,
  CheckCircle,
  Clock,
  Star,
  Search,
  UserPlus,
  X,
  Mail,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import Card from "../../../components/Card";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import apiCall from "../../../utils/api";
import { HOD_WORKERS_URL, HOD_INVITE_WORKER_URL } from "../../../url";

export default function HodWorkersTab() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const filteredWorkers = workers.filter((worker) => {
    const query = searchQuery.toLowerCase();
    return (
      worker.fullName?.toLowerCase().includes(query) ||
      worker.username?.toLowerCase().includes(query) ||
      worker.email?.toLowerCase().includes(query)
    );
  });

  const load = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await apiCall({
        method: "GET",
        url: HOD_WORKERS_URL,
      });

      const payload = res?.data;
      setWorkers(payload?.workers || []);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2:
          e?.response?.data?.message || t("hod.workers.couldNotLoadWorkers"),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load(false);
  }, []);

  const handleInviteWorker = async () => {
    if (!inviteEmail) {
      Toast.show({
        type: "error",
        text1: t("hod.workers.missingInformation"),
        text2: t("hod.workers.enterEmailAddress"),
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      Toast.show({
        type: "error",
        text1: t("hod.workers.invalidEmail"),
        text2: t("hod.workers.validEmailAddress"),
      });
      return;
    }

    try {
      setInviting(true);
      await apiCall({
        method: "POST",
        url: HOD_INVITE_WORKER_URL,
        data: {
          email: inviteEmail,
        },
      });

      Toast.show({
        type: "success",
        text1: t("hod.workers.invitationSent"),
        text2: t("hod.workers.invitationEmailSent", { email: inviteEmail }),
      });

      setShowInviteModal(false);
      setInviteEmail("");
    } catch (e) {
      Toast.show({
        type: "error",
        text1: t("toast.error.failed"),
        text2:
          e?.response?.data?.message || t("hod.workers.couldNotSendInvitation"),
      });
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: colors.backgroundPrimary }}
      >
        <BackButtonHeader
          title={t("hod.workers.title")}
          hasBackButton={false}
        />

        {/* Search Bar */}
        <View className="px-4 py-4">
          <View
            className="flex-row items-center px-4 py-1 rounded-2xl"
            style={{
              backgroundColor: colors.backgroundSecondary,
              borderWidth: 1.5,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Search size={20} color={colors.textSecondary} />
            <TextInput
              className="flex-1 ml-3 text-base"
              style={{ color: colors.textPrimary }}
              placeholder={t("hod.workers.searchPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              editable={false}
            />
          </View>
        </View>

        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            className="text-sm mt-3"
            style={{ color: colors.textSecondary }}
          >
            {t("hod.workers.loadingWorkers")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: colors.backgroundPrimary }}
    >
      <BackButtonHeader title={t("hod.workers.title")} hasBackButton={false} />

      {/* Search Bar */}
      <View className="px-4 py-4">
        <View
          className="flex-row items-center px-4 py-1 rounded-2xl"
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1.5,
            borderColor: colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            className="flex-1 ml-3 text-base"
            style={{ color: colors.textPrimary }}
            placeholder={t("hod.workers.searchPlaceholder")}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Add Worker Button */}
        <TouchableOpacity
          className="mt-3 rounded-xl py-3 px-4 flex-row items-center justify-center"
          style={{ backgroundColor: colors.primary }}
          onPress={() => setShowInviteModal(true)}
          activeOpacity={0.7}
        >
          <UserPlus size={20} color="#FFFFFF" />
          <Text
            className="text-base font-semibold ml-2"
            style={{ color: "#FFFFFF" }}
          >
            {t("hod.workers.inviteWorker")}
          </Text>
        </TouchableOpacity>
      </View>

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
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {filteredWorkers.length === 0 ? (
          <Card style={{ margin: 0, marginTop: 12 }}>
            <View className="items-center py-6">
              <Text
                className="text-base font-semibold"
                style={{ color: colors.textSecondary }}
              >
                {searchQuery
                  ? t("hod.workers.noWorkers")
                  : t("hod.workers.noWorkers")}
              </Text>
            </View>
          </Card>
        ) : (
          filteredWorkers.map((worker, index) => (
            <PressableBlock
              key={worker.id || index}
              onPress={() => router.push(`/hod/worker-details?id=${worker.id}`)}
            >
              <Card style={{ margin: 0, marginBottom: 12, flex: 0 }}>
                {/* Worker Header */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center"
                      style={{ backgroundColor: colors.primary + "20" }}
                    >
                      <User size={24} color={colors.primary} />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text
                        className="text-base font-bold"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.fullName || worker.username}
                      </Text>
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: colors.textSecondary }}
                      >
                        {worker.email}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Worker Stats */}
                <View className="flex-row justify-between">
                  <View className="flex-1 items-center">
                    <View className="flex-row items-center mb-1">
                      <Clock size={14} color={colors.warning || "#F59E0B"} />
                      <Text
                        className="text-lg font-bold ml-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.activeComplaints || 0}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.workers.active")}
                    </Text>
                  </View>

                  <View
                    className="w-[1px]"
                    style={{ backgroundColor: colors.border }}
                  />

                  <View className="flex-1 items-center">
                    <View className="flex-row items-center mb-1">
                      <CheckCircle
                        size={14}
                        color={colors.success || "#10B981"}
                      />
                      <Text
                        className="text-lg font-bold ml-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.completedCount || 0}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.workers.completed")}
                    </Text>
                  </View>

                  <View
                    className="w-[1px]"
                    style={{ backgroundColor: colors.border }}
                  />

                  <View className="flex-1 items-center">
                    <View className="flex-row items-center mb-1">
                      <Star size={14} color={colors.primary} />
                      <Text
                        className="text-lg font-bold ml-1"
                        style={{ color: colors.textPrimary }}
                      >
                        {worker.rating
                          ? worker.rating.toFixed(1)
                          : t("hod.workers.notAvailable")}
                      </Text>
                    </View>
                    <Text
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {t("hod.workers.rating")}
                    </Text>
                  </View>
                </View>
              </Card>
            </PressableBlock>
          ))
        )}
      </ScrollView>

      {/* Invite Worker Modal */}
      <Modal
        visible={showInviteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !inviting && setShowInviteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/50 justify-center items-center px-4"
            onPress={() => !inviting && setShowInviteModal(false)}
          >
            <Pressable
              className="w-full max-w-md rounded-2xl p-6"
              style={{ backgroundColor: colors.backgroundPrimary }}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.primary + "20" }}
                  >
                    <UserPlus size={20} color={colors.primary} />
                  </View>
                  <Text
                    className="text-xl font-bold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("hod.workers.inviteWorker")}
                  </Text>
                </View>
                {!inviting && (
                  <TouchableOpacity
                    onPress={() => setShowInviteModal(false)}
                    className="p-1"
                  >
                    <X size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Form */}
              <View className="mb-6">
                <Text
                  className="text-sm font-semibold mb-2"
                  style={{ color: colors.textPrimary }}
                >
                  {t("hod.workers.inviteForm.email")}
                </Text>
                <View
                  className="flex-row items-center px-4 py-1 rounded-xl"
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Mail size={20} color={colors.textSecondary} />
                  <TextInput
                    className="flex-1 ml-3 text-base"
                    style={{ color: colors.textPrimary }}
                    placeholder={t("hod.workers.inviteForm.emailPlaceholder")}
                    placeholderTextColor={colors.textSecondary}
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!inviting}
                  />
                </View>
              </View>

              <Text
                className="text-xs mb-4"
                style={{ color: colors.textSecondary }}
              >
                {t("hod.workers.inviteForm.inviteDescription")}
              </Text>

              {/* Buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 rounded-xl py-3 border"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: colors.backgroundSecondary,
                  }}
                  onPress={() => setShowInviteModal(false)}
                  disabled={inviting}
                >
                  <Text
                    className="text-center font-semibold"
                    style={{ color: colors.textPrimary }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 rounded-xl py-3 flex-row items-center justify-center"
                  style={{ backgroundColor: colors.primary }}
                  onPress={handleInviteWorker}
                  disabled={inviting}
                >
                  {inviting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      className="text-center font-semibold"
                      style={{ color: "#FFFFFF" }}
                    >
                      {t("hod.workers.inviteForm.sendInvite")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
