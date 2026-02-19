import { Pressable, Text } from "react-native";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function AppButton({ label, onPress, variant = "primary", className = "", disabled }) {
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  const isPrimary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-12 items-center justify-center rounded-lg border ${disabled ? "opacity-60" : ""} ${className}`}
      style={{
        backgroundColor: isPrimary ? colors.primary : colors.backgroundSecondary,
        borderColor: isPrimary ? colors.primary : colors.border,
      }}
    >
      <Text style={{ color: isPrimary ? colors.dark : colors.textPrimary, fontSize: 15, fontWeight: "700" }}>
        {label}
      </Text>
    </Pressable>
  );
}
