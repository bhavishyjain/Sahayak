import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native/icons";
import {
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";

export default function BackButtonHeader({
  title,
  hasBackButton = true,
  rightElement = null,
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  return (
    <View
      className="flex-row justify-between items-center px-4 py-3"
      style={{
        backgroundColor: colors.backgroundPrimary,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingTop: 12,
      }}
    >
      {hasBackButton ? (
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/"); // fallback
            }
          }}
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.backgroundSecondary }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View className="w-10" />
      )}
      <View className="flex-1 items-center justify-center px-2">
        <Text
          className="text-lg font-fira-bold"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ color: colors.textPrimary }}
        >
          {title}
        </Text>
      </View>
      {rightElement ? (
        <View className="items-center justify-center">{rightElement}</View>
      ) : (
        <View className="w-10" />
      )}
    </View>
  );
}
