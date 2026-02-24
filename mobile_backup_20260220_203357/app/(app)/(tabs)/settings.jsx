import { Globe, LogOut, Moon, Settings, Sun, User } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import MenuItem from "../../../components/MenuItem";
import { useAuth } from "../../../contexts/AuthContext";
import { usePreferences } from "../../../contexts/PreferencesContext";
import { darkColors, lightColors } from "../../../theme/colors";

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { theme, language, toggleTheme, changeLanguage } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  const items = useMemo(
    () => [
      {
        icon: User,
        title: "Edit profile",
        subtitle: "Update your profile information",
        onPress: () => router.push("/(app)/(tabs)/edit-profile"),
      },
      {
        icon: theme === "dark" ? Moon : Sun,
        title: "Theme",
        subtitle:
          theme === "dark" ? "Dark mode is active" : "Light mode is active",
        onPress: toggleTheme,
      },
      {
        icon: Globe,
        title: "Language",
        subtitle: `Current language: ${language.toUpperCase()}`,
        onPress: () => changeLanguage(language === "en" ? "hi" : "en"),
      },
      {
        icon: LogOut,
        title: t("logout"),
        subtitle: t("logoutSubtitle"),
        onPress: logout,
        danger: true,
      },
    ],
    [changeLanguage, language, logout, router, t, theme, toggleTheme]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        <Text
          className="text-3xl font-extrabold"
          style={{ color: colors.textPrimary, marginBottom: 14 }}
        >
          {t("settings")}
        </Text>

        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Settings size={20} color={colors.textPrimary} />
            <Text
              style={{
                marginLeft: 8,
                fontWeight: "bold",
                color: colors.textPrimary,
              }}
            >
              Preferences
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            Manage app language, theme, profile, and account access.
          </Text>
        </View>

        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <MenuItem
              key={`${item.title}-${index}`}
              icon={<Icon size={20} color={colors.textPrimary} />}
              title={item.title}
              subtitle={item.subtitle}
              onPress={item.onPress}
              danger={item.danger}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
