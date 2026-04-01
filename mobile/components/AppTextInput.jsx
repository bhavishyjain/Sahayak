import { forwardRef, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";

const AppTextInput = forwardRef(function AppTextInput(
  {
    label,
    left,
    right,
    containerStyle,
    inputContainerStyle,
    inputStyle,
    labelStyle,
    borderColor,
    activeBorderColor,
    backgroundColor,
    editable = true,
    multiline = false,
    dense = false,
    onFocus,
    onBlur,
    placeholderTextColor,
    ...props
  },
  ref,
) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const [isFocused, setIsFocused] = useState(false);

  const resolvedBorderColor = useMemo(() => {
    if (isFocused) {
      return activeBorderColor ?? colors.primary;
    }
    return borderColor ?? colors.border;
  }, [activeBorderColor, borderColor, colors.border, colors.primary, isFocused]);

  const baseInputStyle = useMemo(
    () => ({
      flex: 1,
      color: editable ? colors.textPrimary : colors.textSecondary,
      fontSize: 14,
      minHeight: multiline ? 110 : 48,
      paddingVertical: multiline ? 12 : dense ? 10 : 14,
      paddingHorizontal: left || right ? 0 : 16,
      textAlignVertical: multiline ? "top" : "center",
    }),
    [
      colors.textPrimary,
      colors.textSecondary,
      dense,
      editable,
      left,
      multiline,
      right,
    ],
  );

  return (
    <View style={containerStyle}>
      {label ? (
        <Text
          className="text-xs mb-2"
          style={[{ color: colors.textSecondary }, labelStyle]}
        >
          {label}
        </Text>
      ) : null}

      <View
        className="flex-row items-center rounded-xl"
        style={[
          {
            backgroundColor:
              backgroundColor ?? colors.backgroundSecondary,
            borderWidth: 1,
            borderColor: resolvedBorderColor,
            minHeight: multiline ? 110 : 48,
            opacity: editable ? 1 : 0.8,
          },
          inputContainerStyle,
        ]}
      >
        {left ? <View className="pl-4 pr-2">{left}</View> : null}

        <TextInput
          ref={ref}
          {...props}
          editable={editable}
          multiline={multiline}
          placeholderTextColor={placeholderTextColor ?? colors.placeholder}
          selectionColor={colors.primary}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          style={[
            baseInputStyle,
            inputStyle,
          ]}
        />

        {right ? <View className="pl-2 pr-4">{right}</View> : null}
      </View>
    </View>
  );
});

export default AppTextInput;
