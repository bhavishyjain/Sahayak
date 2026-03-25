import * as Clarity from "@microsoft/react-native-clarity";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import {
  BarChart2,
  Bell,
  Brain,
  CirclePlus,
  Globe,
  ListChecks,
  LogOut,
  Moon,
  Pencil,
  ShieldCheck,
  Sun,
  Trash2,
  CheckCircle,
  FileText,
  UserPlus,
  MessageSquareQuote,
  Send,
  SearchCheck,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../../../colors";
import AutoSkeleton from "../../../components/AutoSkeleton";
import DialogBox from "../../../components/DialogBox";
import LanguagePicker from "../../../components/LanguagePicker";
import MenuScreenLayout from "../../../components/MenuScreenLayout";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth, { clearUserAuth } from "../../../utils/userAuth";
import apiCall from "../../../utils/api";
import { DELETE_ACCOUNT_URL } from "../../../url";

// HELPER FUNCTIONS

// Generate consistent color from name
const getAvatarColor = (name) => {
  if (!name) return "#999";

  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#FFA07A",
    "#98D8C8",
    "#F7DC6F",
    "#BB8FCE",
    "#85C1E2",
    "#F8B739",
    "#52B788",
    "#FF8B94",
    "#A8E6CF",
    "#FFD3B6",
    "#FFAAA5",
    "#FF8C94",
  ];

  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

// Get initials from name
const getInitials = (name) => {
  if (!name) return "U";
  return name.charAt(0).toUpperCase();
};

const ProfileHeader = React.memo(({ user, colors, t, loading }) => {
  const avatarColor = getAvatarColor(user?.fullName);
  const initials = getInitials(user?.fullName);

  return (
    <AutoSkeleton isLoading={loading}>
      <View className="items-center mb-8">
        <View className="relative">
          <View
            className="rounded-full border-2 overflow-hidden items-center justify-center"
            style={{
              borderColor: colors.textPrimary,
              backgroundColor: avatarColor,
              width: 96,
              height: 96,
            }}
          >
            <Text
              className="font-bold"
              style={{
                color: "#FFFFFF",
                fontSize: 40,
              }}
            >
              {initials}
            </Text>
          </View>

          {/* Edit Button */}
          <PressableBlock
            className="absolute bottom-0 right-0 p-2 rounded-full"
            style={{ backgroundColor: colors.backgroundSecondary }}
            onPress={() => router.push("/(app)/more/update-profile")}
          >
            <Pencil size={18} color={colors.textPrimary} />
          </PressableBlock>
        </View>

        <Text
          className="text-lg font-bold mt-3"
          style={{ color: colors.textPrimary }}
        >
          {user?.fullName ?? t("common.loading")}
        </Text>

        <Text style={{ color: colors.textSecondary }}>{user?.phone ?? ""}</Text>
        <Text style={{ color: colors.textSecondary }}>{user?.email ?? ""}</Text>
      </View>
    </AutoSkeleton>
  );
});
ProfileHeader.displayName = "ProfileHeader";

export default function More() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const languagePickerRef = useRef(null);
  const [showClarityDialog, setShowClarityDialog] = useState(false);

  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );

  const CLARITY_CONSENT_KEY = "clarity_analytics_consent";

  const loadUser = React.useCallback(async () => {
    try {
      const authUser = await getUserAuth();
      setUser(authUser);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useFocusEffect(
    React.useCallback(() => {
      loadUser();
    }, [loadUser]),
  );

  const toggleConsent = async (bool) => {
    await Clarity.consent(false, bool);
    await AsyncStorage.setItem(CLARITY_CONSENT_KEY, bool ? "1" : "0");
    setShowClarityDialog(false);
  };

  const SETTINGS_ITEMS = [
    ...(user?.role === "user"
      ? [
          {
            icon: CirclePlus,
            title: "complaints.newComplaint",
            subtitle: "complaints.registerComplaint",
            route: "/(app)/more/new-complaint",
          },
          {
            icon: ListChecks,
            title: "more.menu.myComplaints.title",
            subtitle: "more.menu.myComplaints.description",
            route: "/(app)/more/my-complaints",
          },
        ]
      : []),
    ...(user?.role === "head"
      ? [
          {
            icon: FileText,
            title: "more.menu.reports.title",
            subtitle: "more.menu.reports.description",
            route: "/(app)/more/hod-reports",
          },
          {
            icon: CheckCircle,
            title: "more.menu.resolvedComplaints.title",
            subtitle: "more.menu.resolvedComplaints.description",
            route: "/(app)/more/hod-resolved",
          },
          {
            icon: UserPlus,
            title: "more.menu.manageInvitations.title",
            subtitle: "more.menu.manageInvitations.subtitle",
            route: "/(app)/more/hod-manage-invitations",
          },
          {
            icon: Brain,
            title: "more.menu.aiReviewQueue.title",
            subtitle: "more.menu.aiReviewQueue.subtitle",
            route: "/(app)/hod/ai-review",
          },
          {
            icon: ShieldCheck,
            title: "Special requests",
            subtitle: "Send and track complaint edit or delete requests.",
            route: "/(app)/more/special-requests",
          },
        ]
      : []),
    // Worker-only: Completed Complaints
    ...(user?.role === "worker"
      ? [
          {
            icon: CheckCircle,
            title: "more.menu.completedWork.title",
            subtitle: "more.menu.completedWork.description",
            route: "/(app)/more/worker-completed",
          },
          {
            icon: BarChart2,
            title: "more.menu.workerAnalytics.title",
            subtitle: "more.menu.workerAnalytics.subtitle",
            route: "/(app)/more/worker-analytics",
          },
          {
            icon: MessageSquareQuote,
            title: "more.menu.workerFeedback.title",
            subtitle: "more.menu.workerFeedback.subtitle",
            route: "/(app)/more/worker-feedback",
          },
        ]
      : []),
    ...(user?.role === "admin"
      ? [
          {
            icon: SearchCheck,
            title: "Edit complaint",
            subtitle: "Search by complaint ID, update department or priority, and delete complaints.",
            route: "/(app)/more/admin-edit-complaint",
          },
          {
            icon: Send,
            title: "Send notification",
            subtitle: "Draft admin notifications and review notification history in one place.",
            route: "/(app)/more/admin-send-notification",
          },
          {
            icon: ShieldCheck,
            title: "Special requests",
            subtitle: "Accept or reject HOD complaint edit and delete requests.",
            route: "/(app)/more/special-requests",
          },
        ]
      : []),
    {
      icon: Bell,
      title: "more.menu.notifications.title",
      subtitle: "more.menu.notifications.subtitle",
      route: "/(app)/more/notifications",
    },
    {
      icon: colorScheme === "dark" ? Moon : Sun,
      title: "more.menu.theme.title",
      subtitle: () =>
        colorScheme === "dark"
          ? t("more.menu.theme.subtitle.dark")
          : t("more.menu.theme.subtitle.light"),
      route: "/(app)/more/theme",
    },
    {
      icon: Globe,
      title: "more.menu.language.title",
      subtitle: "more.menu.language.subtitle",
      onPress: () => languagePickerRef.current?.openModal(),
    },
    {
      icon: Trash2,
      iconColor: "red",
      title: "more.menu.deleteAccount.title",
      subtitle: "more.menu.deleteAccount.subtitle",
      onPress: () => setShowDeleteAccountDialog(true),
    },
    {
      icon: LogOut,
      title: "more.menu.logout.title",
      subtitle: "more.menu.logout.subtitle",
      onPress: () => setShowLogoutDialog(true),
      danger: true,
    },
  ];

  // Profile header component with loading state
  const ProfileHeaderComponent = useMemo(
    () => (
      <ProfileHeader user={user} colors={colors} t={t} loading={isLoading} />
    ),
    [user, colors, t, isLoading],
  );

  return (
    <>
      <MenuScreenLayout
        titleKey="more.title"
        analyticsName="SettingsIndex"
        items={SETTINGS_ITEMS}
        headerComponent={ProfileHeaderComponent}
        hasBackButton={false}
      />

      <LanguagePicker ref={languagePickerRef} modalOnly />

      <DialogBox
        visible={showClarityDialog}
        title={t("more.menu.tracking.modalTitle")}
        message={t("more.menu.tracking.modalMessage")}
        confirmText={t("common.allow")}
        cancelText={t("common.dontAllow")}
        onConfirm={() => toggleConsent(true)}
        onCancel={() => toggleConsent(false)}
      />

      <DialogBox
        visible={showDeleteAccountDialog}
        title={t("more.menu.deleteAccount.modalTitle")}
        message={t("more.menu.deleteAccount.modalMessage")}
        confirmText={t("more.menu.deleteAccount.confirmText")}
        cancelText={t("common.cancel")}
        loading={deletingAccount}
        showInput
        inputPlaceholder={t("more.menu.deleteAccount.passwordPlaceholder")}
        inputValue={deletePassword}
        onInputChange={setDeletePassword}
        onConfirm={async () => {
          if (!deletePassword.trim()) {
            Toast.show({
              type: "error",
              text1: t("more.menu.deleteAccount.passwordRequired"),
            });
            return;
          }
          setDeletingAccount(true);
          try {
            await apiCall({
              method: "DELETE",
              url: DELETE_ACCOUNT_URL,
              data: { password: deletePassword },
            });
            setShowDeleteAccountDialog(false);
            await clearUserAuth();
            router.replace("/(app)/(auth)/login");
          } catch (err) {
            const msg =
              err?.response?.data?.message ??
              err?.message ??
              t("more.menu.deleteAccount.deleteFailed");
            Toast.show({
              type: "error",
              text1: t("toast.error.failed"),
              text2: msg,
            });
          } finally {
            setDeletingAccount(false);
            setDeletePassword("");
          }
        }}
        onCancel={() => {
          setShowDeleteAccountDialog(false);
          setDeletePassword("");
        }}
      />

      {/* Logout Confirmation Dialog */}
      <DialogBox
        visible={showLogoutDialog}
        title={t("more.dialog.logout.title")}
        message={t("more.dialog.logout.message")}
        confirmText={t("more.dialog.logout.confirm")}
        cancelText={t("more.dialog.logout.cancel")}
        onConfirm={async () => {
          setShowLogoutDialog(false);
          router.replace("/(app)/(auth)/logout");
        }}
        onCancel={() => setShowLogoutDialog(false)}
      />
    </>
  );
}
