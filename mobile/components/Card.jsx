import { ImageBackground, Text, TouchableOpacity, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";

export default function Card({
  children,
  label,
  bgColor,
  labelColor,
  style,
  bgImage = null,
  onPress,
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const backgroundColor =
    bgImage === null ? (bgColor ?? colors.backgroundSecondary) : undefined;

  const textColor = labelColor || colors.textPrimary;

  const Container = bgImage ? ImageBackground : View;
  const containerProps = bgImage
    ? { source: bgImage, resizeMode: "cover" }
    : {};

  const content = (
    <View className="p-4">
      {children}
      {label && (
        <Text className="text-xs mt-1" style={{ color: textColor }}>
          {label}
        </Text>
      )}
    </View>
  );

  return (
    <Container
      {...containerProps}
      className="rounded-2xl m-1 overflow-hidden flex-1"
      style={[
        {
          backgroundColor,
          flex: 1,
          flexGrow: 1,
          flexBasis: 0,
        },
        style,
      ]}
    >
      {onPress ? (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={{ flex: 1 }}
        >
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}
    </Container>
  );
}
