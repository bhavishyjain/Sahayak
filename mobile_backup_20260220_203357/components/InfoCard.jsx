import { Text, View } from "react-native";
import { darkColors, lightColors } from "../theme/colors";
import { useTheme } from "../utils/context/theme";

export default function InfoCard({
  label,
  value,
  icon: Icon,
  iconColor,
  labelColor,
  valueColor,
  isLast = false,
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  return (
    <>
      <View className="flex-row items-center justify-between py-3">
        <View className="flex-row items-center flex-1">
          {Icon && <Icon size={18} color={iconColor || colors.textPrimary} />}
          <Text
            className="text-sm ml-3"
            style={{ color: labelColor || colors.textSecondary }}
          >
            {label}
          </Text>
        </View>
        <Text
          className="text-base font-semibold"
          style={{ color: valueColor || colors.textPrimary }}
        >
          {value}
        </Text>
      </View>
      {!isLast && (
        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 4,
          }}
        />
      )}
    </>
  );
}
