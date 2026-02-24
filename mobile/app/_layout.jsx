import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/utils/context/theme";
import { LanguageProvider } from "@/utils/i18n/LanguageProvider";
import { View } from "react-native";
import Toast from "react-native-toast-message";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "@/utils/context/theme";
import "../global.css";
import "../utils/i18n/config";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RootNavigator() {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  return (
    <View style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast position="bottom" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <RootNavigator />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
