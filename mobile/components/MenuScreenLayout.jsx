import * as Clarity from "@microsoft/react-native-clarity";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { darkColors, lightColors } from "../app/(app)/colors";
import { useTheme } from "../utils/context/theme";
import { useTranslation } from "../utils/i18n/LanguageProvider";
import BackButtonHeader from "./BackButtonHeader";
import MenuItem from "./MenuItem";

export default function MenuScreenLayout({
  titleKey,
  analyticsName,
  items = [],
  headerComponent = null,
  footerComponent = null,
  hasBackButton = true,
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (analyticsName) {
      Clarity.setCurrentScreenName(analyticsName);
    }
  }, [analyticsName]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <BackButtonHeader title={t(titleKey)} hasBackButton={hasBackButton} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        {headerComponent}

        {items.map((item, index) => {
          const Icon = item.icon;

          const handlePress = () => {
            if (item.onPress) return item.onPress();
            if (item.route) router.push(item.route);
          };

          // Don't set icon color if danger is true - let MenuItem handle it
          const iconElement = item.danger ? (
            <Icon />
          ) : (
            <Icon color={item.iconColor || colors.textPrimary} />
          );

          return (
            <MenuItem
              key={index}
              icon={iconElement}
              title={t(item.title)}
              subtitle={
                typeof item.subtitle === "function"
                  ? item.subtitle()
                  : t(item.subtitle)
              }
              onPress={handlePress}
              danger={item.danger}
            />
          );
        })}

        {footerComponent}
      </ScrollView>
    </View>
  );
}
