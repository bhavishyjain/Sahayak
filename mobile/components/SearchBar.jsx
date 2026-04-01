import { Search, X } from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import { darkColors, lightColors } from "../colors";
import AppTextInput from "./AppTextInput";
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
    <AppTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      dense
      borderColor={value ? colors.primary : colors.border}
      activeBorderColor={colors.primary}
      containerStyle={style}
      inputContainerStyle={{ minHeight: 44 }}
      inputStyle={{ fontSize: 14, minHeight: 44, paddingVertical: 6 }}
      left={
        <Search
          size={16}
          color={value ? colors.primary : colors.textSecondary}
        />
      }
      right={
        value ? (
          <TouchableOpacity onPress={handleClear} hitSlop={8}>
            <X size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null
      }
    />
  );
}
