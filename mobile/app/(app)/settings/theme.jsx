import * as Clarity from "@microsoft/react-native-clarity";
import { Moon, Settings, Sun } from "lucide-react-native";
import { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { darkColors, lightColors } from "../../../colors";
import BackButtonHeader from "../../../components/BackButtonHeader";
import { useTheme } from "../../../utils/context/theme";
import { useTranslation } from "../../../utils/i18n/LanguageProvider";

const THEME_OPTIONS = [
  {
    id: "system",
    icon: Settings,
    name: "more.settings.theme.system",
    desc: "more.settings.theme.systemDesc",
  },
  {
    id: "light",
    icon: Sun,
    name: "more.settings.theme.light",
    desc: "more.settings.theme.lightDesc",
  },
  {
    id: "dark",
    icon: Moon,
    name: "more.settings.theme.dark",
    desc: "more.settings.theme.darkDesc",
  },
];

export default function ThemeSettings() {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme, themePreference } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  useEffect(() => {
    Clarity.setCurrentScreenName("ThemeSettings");
  }, []);

  const currentTheme = THEME_OPTIONS.find((t) => t.id === themePreference);

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <BackButtonHeader title={t("more.settings.theme.title")} />

      <View style={{ padding: 16 }}>
        {/* CURRENT THEME CARD */}
        <View
          style={{
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 2,
            borderColor: colors.primary,
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              marginBottom: 10,
            }}
          >
            {t("more.settings.theme.selectTheme")}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {currentTheme && (
              <currentTheme.icon size={32} color={colors.primary} />
            )}

            <View style={{ marginLeft: 12 }}>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: colors.primary,
                }}
              >
                {t(currentTheme?.name)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {t("more.settings.theme.currentlyActive")}
              </Text>
            </View>
          </View>
        </View>

        {/* LABEL */}
        <Text
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            marginBottom: 10,
          }}
        >
          {t("more.settings.theme.selectThemeLabel")}
        </Text>

        {/* OPTIONS */}
        {THEME_OPTIONS.map((theme) => {
          const Icon = theme.icon;
          const selected = themePreference === theme.id;

          return (
            <TouchableOpacity
              key={theme.id}
              onPress={() => setColorScheme(theme.id)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderRadius: 12,
                marginBottom: 10,
                backgroundColor: colors.backgroundSecondary,
                borderWidth: 2,
                borderColor: selected ? colors.primary : "transparent",
              }}
            >
              <Icon
                size={28}
                color={selected ? colors.primary : colors.textSecondary}
              />

              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: selected ? colors.primary : colors.textPrimary,
                  }}
                >
                  {t(theme.name)}
                </Text>

                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  {t(theme.desc)}
                </Text>
              </View>

              {selected && (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.dark, fontWeight: "bold" }}>
                    ✓
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
