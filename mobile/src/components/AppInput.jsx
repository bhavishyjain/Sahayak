import { Text, TextInput, View } from "react-native";
import { usePreferences } from "../contexts/PreferencesContext";
import { darkColors, lightColors } from "../theme/colors";

export default function AppInput({ label, value, onChangeText, placeholder, secureTextEntry, multiline = false }) {
  const { theme } = usePreferences();
  const colors = theme === "dark" ? darkColors : lightColors;

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ marginBottom: 6, color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.backgroundCard,
          color: colors.textPrimary,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 12,
          minHeight: multiline ? 96 : 48,
          textAlignVertical: multiline ? "top" : "center",
          fontSize: 15,
          fontWeight: "600",
        }}
      />
    </View>
  );
}
