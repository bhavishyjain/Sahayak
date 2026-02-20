import { ArrowRight } from "lucide-react-native";
import { ActivityIndicator } from "react-native";
import RNSwipeButton from "rn-swipe-button";
import { darkColors, lightColors } from "../app/(app)/colors";
import { useTheme } from "../utils/context/theme";
import getReadableTextColor from "./ColorHelper";

export default function SwipeButton({
  type = "primary",
  onSwipeSuccess,
  title,
  loader = false,
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  // Type colors remain consistent across themes for semantic meaning
  const TYPE_COLORS = {
    primary: colors.primary,
    secondary: colors.secondary,
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    error: colors.error,
    dark: colors.dark,
    light: colors.light,
  };

  const bgColor = TYPE_COLORS[type] || colors.primary;
  const textColor = getReadableTextColor(bgColor);
  const iconColor = colorScheme === "dark" ? "#ffffff" : colors.textPrimary;

  return (
    <RNSwipeButton
      title={loader ? <ActivityIndicator size={20} color={textColor} /> : title}
      titleStyles={{
        color: textColor,
        fontSize: 16,
        fontWeight: "800",
      }}
      railBackgroundColor={bgColor}
      railBorderColor={bgColor}
      railStyles={{
        borderRadius: 8,
        height: 56,
        borderWidth: 0,
      }}
      thumbIconComponent={() =>
        loader ? (
          <ActivityIndicator size={20} color={iconColor} />
        ) : (
          <ArrowRight size={20} color={iconColor} />
        )
      }
      thumbIconBackgroundColor={colors.backgroundPrimary}
      thumbIconBorderColor={colors.backgroundPrimary}
      thumbIconStyles={{
        borderRadius: 6,
        width: 48,
        height: 48,
        borderWidth: 0,
        top: 6,
      }}
      containerStyles={{
        borderRadius: 8,
        overflow: "hidden",
      }}
      onSwipeSuccess={onSwipeSuccess}
      railTitle={title}
      railFillBackgroundColor={colors.backgroundPrimary}
      railFillBorderColor={colors.backgroundPrimary}
      swipeSuccessThreshold={70}
      shouldResetAfterSuccess
    />
  );
}
