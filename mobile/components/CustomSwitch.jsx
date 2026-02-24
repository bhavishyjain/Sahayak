import { useEffect, useRef } from "react";
import { Animated, Pressable, ActivityIndicator } from "react-native";
import { colors } from "../colors";

export default function CustomSwitch({
  value,
  onValueChange,
  disabled = false,
  activeColor = colors.primary,
  inactiveColor = "transparent",
  thumbColor = "#FFFFFF",
  size = "medium", // small, medium, large
  loading = false,
}) {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  // Size configurations
  const sizes = {
    small: { width: 40, height: 20, thumbSize: 16, padding: 2 },
    medium: { width: 48, height: 24, thumbSize: 20, padding: 2 },
    large: { width: 56, height: 28, thumbSize: 24, padding: 2 },
  };

  const config = sizes[size] || sizes.medium;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      speed: 20,
      bounciness: 8,
    }).start();
  }, [value]);

  const handlePress = () => {
    if (!disabled && !loading && onValueChange) {
      onValueChange(!value);
    }
  };

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  const borderColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#D1D5DB", activeColor],
  });

  const thumbPosition = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, config.width - config.thumbSize - config.padding - 2],
  });

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={{
          width: config.width,
          height: config.height,
          borderRadius: config.height / 2,
          backgroundColor,
          borderWidth: 2,
          borderColor,
          justifyContent: "center",
        }}
      >
        <Animated.View
          style={{
            width: config.thumbSize,
            height: config.thumbSize,
            borderRadius: config.thumbSize / 2,
            backgroundColor: loading ? "transparent" : thumbColor,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: loading ? "transparent" : "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: loading ? 0 : 0.2,
            shadowRadius: 2,
            elevation: loading ? 0 : 3,
            transform: [{ translateX: thumbPosition }],
          }}
        >
          {loading && <ActivityIndicator size="small" color={activeColor} />}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
