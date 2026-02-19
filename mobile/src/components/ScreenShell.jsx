import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, View } from "react-native";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function ScreenShell({ children, scroll = true }) {
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;
  const Wrapper = scroll ? ScrollView : View;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.backgroundPrimary }}>
      <Wrapper
        style={{ flex: 1, paddingHorizontal: 16, backgroundColor: colors.backgroundPrimary }}
        contentContainerStyle={scroll ? { paddingBottom: 24 } : undefined}
      >
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}
