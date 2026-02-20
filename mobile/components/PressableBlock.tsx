import React, { useEffect } from "react";
import { Pressable, PressableProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  scaleTo?: number;
  durationIn?: number;
  durationOut?: number;
  activeOpacity?: number;
  disabled?: boolean;
};

export default function PressableBlock({
  scaleTo = 0.95,
  durationIn = 90,
  durationOut = 120,
  activeOpacity = 0.85,
  style,
  children,
  disabled = false,
  ...props
}: Props) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(disabled ? 0.5 : 1, {
      duration: durationOut,
      easing: Easing.out(Easing.quad),
    });
  }, [disabled, durationOut, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={() => {
        if (disabled) return;
        scale.value = withTiming(scaleTo, {
          duration: durationIn,
          easing: Easing.out(Easing.quad),
        });
        if (activeOpacity !== 1) {
          opacity.value = withTiming(activeOpacity, {
            duration: durationIn,
            easing: Easing.out(Easing.quad),
          });
        }
      }}
      onPressOut={() => {
        if (disabled) {
          return;
        }
        scale.value = withTiming(1, {
          duration: durationOut,
          easing: Easing.out(Easing.quad),
        });
        if (activeOpacity !== 1) {
          opacity.value = withTiming(1, {
            duration: durationOut,
            easing: Easing.out(Easing.quad),
          });
        }
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
