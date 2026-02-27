import { Text, View } from "react-native";
import Card from "./Card";

export default function MetricCard({
  colors,
  Icon,
  iconColor,
  iconBgColor,
  title,
  value,
  subtitle,
  style,
  valueColor,
}) {
  return (
    <Card style={{ margin: 0, flex: 1, ...style }}>
      <View className="flex-row items-center justify-between mb-3">
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: iconBgColor }}
        >
          <Icon size={20} color={iconColor} />
        </View>
      </View>
      <Text className="text-xs mb-1" style={{ color: colors.textSecondary }}>
        {title}
      </Text>
      <Text
        className="text-3xl font-bold"
        style={{ color: valueColor || colors.textPrimary }}
      >
        {value}
      </Text>
      {subtitle ? (
        <Text className="text-xs mt-1" style={{ color: colors.textSecondary }}>
          {subtitle}
        </Text>
      ) : null}
    </Card>
  );
}
