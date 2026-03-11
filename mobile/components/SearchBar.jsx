import { Search } from "lucide-react-native";
import { TextInput, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";

/**
 * Reusable search bar used across complaint list screens.
 * Props: value, onChangeText, placeholder, style
 */
export default function SearchBar({ value, onChangeText, placeholder, style }) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  return (
    <View
      className="flex-row items-center px-4 py-2 rounded-xl"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1.5,
        borderColor: colors.border,
        ...style,
      }}
    >
      <Search size={18} color={colors.textSecondary} />
      <TextInput
        className="flex-1 ml-3 text-base"
        style={{ color: colors.textPrimary }}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}
