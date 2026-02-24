import { Stack } from "expo-router";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { darkColors, lightColors } from "../../colors";
import { useTheme } from "../../utils/context/theme";

export default function RootLayout() {
  const { colorScheme } = useTheme();

  // Get current theme colors
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  // Configure safe area edges - consistent for all tab pages to prevent shifting
  const getEdges = () => {
    // Always apply bottom edge on Android for navigation bar
    // Don't apply top edge as status bar height is handled in individual pages
    return Platform.OS === "ios" ? ["top"] : ["bottom"];
  };

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          className="flex-1"
          style={{ backgroundColor: colors.backgroundPrimary }}
          edges={getEdges()}
        >
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaView>
      </GestureHandlerRootView>
    </>
  );
}
