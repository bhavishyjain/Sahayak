import { Bell, Languages, LogOut, Moon, Sun, User } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "../../../api/client";
import Card from "../../../components/Card";
import MenuItem from "../../../components/MenuItem";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";
import { showToast } from "../../../utils/toast";

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { logout, token, user } = useAuth();
  const { theme, language, toggleTheme, changeLanguage } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;
  const initials = (user?.fullName || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sendTestPush = async () => {
    try {
      await api.sendTestNotification(token);
      showToast({
        title: t("success"),
        message: t("testNotificationSent"),
        type: "success",
      });
    } catch (error) {
      showToast({
        title: t("failed"),
        message: error.message || t("testNotificationFailed"),
        type: "error",
      });
    }
  };

  const items = useMemo(
    () => [
      {
        icon: <User size={18} />,
        title: t("editProfile"),
        subtitle: t("editProfileSubtitle"),
        onPress: () => navigation.navigate("EditProfile"),
      },
      {
        icon: <Languages size={18} />,
        title: t("language"),
        subtitle: `${t("currentLanguage")}: ${language.toUpperCase()} (${t(
          language === "en" ? "english" : "hindi"
        )})`,
        onPress: () => changeLanguage(language === "en" ? "hi" : "en"),
      },
      {
        icon: theme === "dark" ? <Moon size={18} /> : <Sun size={18} />,
        title: t("darkMode"),
        subtitle: `${t("currentTheme")}: ${theme}`,
        onPress: toggleTheme,
      },
      {
        icon: <Bell size={18} />,
        title: t("sendTestNotification"),
        subtitle: t("sendTestNotificationSubtitle"),
        onPress: sendTestPush,
      },
      {
        icon: <LogOut size={18} />,
        title: t("logout"),
        subtitle: t("logoutSubtitle"),
        onPress: logout,
        danger: true,
      },
    ],
    [changeLanguage, language, logout, navigation, t, theme, toggleTheme]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="mt-3 text-3xl font-extrabold" style={{ color: colors.textPrimary }}>
          {t("settings")}
        </Text>
        <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
          {t("settingsSubtitle")}
        </Text>

        <Card className="mt-5 mb-4">
          <View className="flex-row items-center">
            <View
              className="h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: `${colors.primary}25` }}
            >
              <Text className="text-lg font-extrabold" style={{ color: colors.primary }}>
                {initials}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-bold" style={{ color: colors.textPrimary }}>
                {user?.fullName || "User"}
              </Text>
              <Text className="mt-0.5 text-xs" style={{ color: colors.textSecondary }}>
                {user?.email || "-"}
              </Text>
            </View>
          </View>
        </Card>

        {items.map((item, index) => (
          <MenuItem
            key={`${item.title}-${index}`}
            icon={item.icon}
            title={item.title}
            subtitle={item.subtitle}
            onPress={item.onPress}
            danger={item.danger}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
