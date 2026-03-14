import { Search, X } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { TextInput as PaperTextInput } from "react-native-paper";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";

/**
 * Reusable search bar used across complaint list screens.
 * Props: value, onChangeText, placeholder, onClear, style
 * The clear button is shown automatically when value is non-empty.
 * onClear defaults to calling onChangeText("") if not provided.
 */
export default function SearchBar({
  value,
  onChangeText,
  placeholder,
  onClear,
  style,
}) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  const handleClear = onClear ?? (() => onChangeText(""));

  return (
    <View
      className="flex-row items-center px-4 rounded-xl"
      style={{
        backgroundColor: colors.backgroundSecondary,
        minHeight: 44,
        borderWidth: 1,
        borderColor: value ? colors.primary : colors.border,
        ...style,
      }}
    >
      <Search size={16} color={value ? colors.primary : colors.textSecondary} />
      <PaperTextInput
        mode="flat"
        dense
        style={{
          flex: 1,
          marginLeft: 8,
          backgroundColor: "transparent",
          fontSize: 14,
          color: colors.textPrimary,
        }}
        contentStyle={{
          color: colors.textPrimary,
          fontSize: 14,
          paddingVertical: 6,
          paddingHorizontal: 0,
        }}
        underlineStyle={{ display: "none" }}
        theme={{
          colors: {
            text: colors.textPrimary,
          },
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
      />
      {!!value && (
        <TouchableOpacity onPress={handleClear} hitSlop={8}>
          <X size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
}
