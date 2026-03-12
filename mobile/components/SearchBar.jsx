import { Search, X } from "lucide-react-native";
import { TextInput, TouchableOpacity, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";

/**
 * Reusable search bar used across complaint list screens.
 * Props: value, onChangeText, placeholder, onClear, style
 * The clear button is shown automatically when value is non-empty.
 * onClear defaults to calling onChangeText("") if not provided.
 */
export default function SearchBar({ value, onChangeText, placeholder, onClear, style }) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const handleClear = onClear ?? (() => onChangeText(""));

  return (
    <View
      className="flex-row items-center px-4 py-2 rounded-xl"
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1.5,
        borderColor: value ? colors.primary : colors.border,
        ...style,
      }}
    >
      <Search size={18} color={value ? colors.primary : colors.textSecondary} />
      <TextInput
        className="flex-1 ml-3 text-base"
        style={{ color: colors.textPrimary }}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
      />
      {!!value && (
        <TouchableOpacity onPress={handleClear} hitSlop={8}>
          <X size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}
