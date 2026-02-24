import { cloneElement } from "react";
import { Text, View } from "react-native";
import { getShadows } from "../assets/style";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";
import PressableBlock from "./PressableBlock";

export default function MenuItem({ icon, title, subtitle, onPress, danger }) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const shadows = getShadows(colorScheme);

  const iconColor = danger ? colors.danger : colors.textPrimary;

  return (
    <PressableBlock
      onPress={onPress}
      className="flex-row items-center rounded-xl p-4 mb-4"
      style={{
        backgroundColor: colors.backgroundSecondary,
        ...shadows.sm,
      }}
    >
      <View className="w-6 h-6 items-center justify-center">
        {icon && cloneElement(icon, { ...icon.props, color: iconColor })}
      </View>

      <View className="ml-4 flex-1">
        <Text
          className="font-semibold"
          style={{ color: danger ? colors.danger : colors.textPrimary }}
        >
          {title}
        </Text>
        <Text
          className="text-sm"
          style={{ color: colors.textSecondary }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
    </PressableBlock>
  );
}
