import * as Clarity from "@microsoft/react-native-clarity";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Globe, LogOut, Moon, Pencil, Sun, Trash2 } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { darkColors, lightColors } from "../../../colors";
import AutoSkeleton from "../../../components/AutoSkeleton";
import DialogBox from "../../../components/DialogBox";
import LanguagePicker from "../../../components/LanguagePicker";
import MenuScreenLayout from "../../../components/MenuScreenLayout";
import PressableBlock from "../../../components/PressableBlock";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";
import getUserAuth from "../../../utils/userAuth";

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
  if (!name) return "?";
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
            onPress={() => router.push("/(app)/settings/update-profile")}
          >
            <Pencil size={18} color={colors.textPrimary} />
          </PressableBlock>
        </View>

        <Text
          className="text-lg font-bold mt-3"
          style={{ color: colors.textPrimary }}
        >
          {user?.fullName || "Loading..."}
        </Text>

        <Text style={{ color: colors.textSecondary }}>{user?.phone || ""}</Text>
        <Text style={{ color: colors.textSecondary }}>{user?.email || ""}</Text>
      </View>
    </AutoSkeleton>
  );
});
ProfileHeader.displayName = "ProfileHeader";

export default function Setting() {
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);

  const languagePickerRef = useRef(null);
  const [showClarityDialog, setShowClarityDialog] = useState(false);

  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );

  const CLARITY_CONSENT_KEY = "clarity_analytics_consent";

  useEffect(() => {
    (async () => {
      try {
        const authUser = await getUserAuth();
        setUser(authUser);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const toggleConsent = async (bool) => {
    await Clarity.consent(false, bool);
    await AsyncStorage.setItem(CLARITY_CONSENT_KEY, bool ? "1" : "0");
    setShowClarityDialog(false);
  };

  const SETTINGS_ITEMS = [
    {
      icon: colorScheme === "dark" ? Moon : Sun,
      title: "more.settings.menu.theme.title",
      subtitle: () =>
        colorScheme === "dark"
          ? t("more.settings.menu.theme.subtitle.dark")
          : t("more.settings.menu.theme.subtitle.light"),
      route: "/(app)/settings/theme",
    },
    {
      icon: Globe,
      title: "more.settings.menu.language.title",
      subtitle: "more.settings.menu.language.subtitle",
      onPress: () => languagePickerRef.current?.openModal(),
    },
    {
      icon: Trash2,
      iconColor: "red",
      title: "more.settings.menu.deleteAccount.title",
      subtitle: "more.settings.menu.deleteAccount.subtitle",
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
        titleKey="more.settings.title"
        analyticsName="SettingsIndex"
        items={SETTINGS_ITEMS}
        headerComponent={ProfileHeaderComponent}
        hasBackButton={false}
      />

      <LanguagePicker ref={languagePickerRef} modalOnly />

      <DialogBox
        visible={showClarityDialog}
        title={t("more.settings.menu.tracking.modalTitle")}
        message={t("more.settings.menu.tracking.modalMessage")}
        confirmText="Allow"
        cancelText="Don't Allow"
        onConfirm={() => toggleConsent(true)}
        onCancel={() => toggleConsent(false)}
      />

      <DialogBox
        visible={showDeleteAccountDialog}
        title={t("more.settings.menu.deleteAccount.modalTitle")}
        message={t("more.settings.menu.deleteAccount.modalMessage")}
        confirmText="OK"
        cancelText="Cancel"
        onConfirm={() => setShowDeleteAccountDialog(false)}
        onCancel={() => setShowDeleteAccountDialog(false)}
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
