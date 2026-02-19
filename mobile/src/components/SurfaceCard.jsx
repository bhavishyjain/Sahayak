import { View } from "react-native";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function SurfaceCard({ children, className = "", style }) {
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <View
      className={`rounded-xl border p-4 ${className}`}
      style={[
        {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
