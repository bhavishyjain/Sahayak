import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native/icons";
import {
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";

export default function BackButtonHeader({
  title,
  hasBackButton = true,
  order = null,
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
        paddingTop:
          Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 12 : 12,
      }}
    >
      {hasBackButton ? (
        <TouchableOpacity
          onPress={() => {
            if (order && order.orderstatus_id) {
              switch (order.orderstatus_id) {
                case 3:
                  router.replace("/(app)/(tabs)/accepted");
                  return;
                case 4:
                  router.replace("/(app)/(tabs)/picked-up");
                  return;
                default:
                  break;
              }
            }

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
      <View className="w-10" />
    </View>
  );
}
