import type { FC } from "react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, View } from "react-native";
import { AutoSkeletonView } from "react-native-auto-skeleton";
import { useTheme } from "../../utils/context/theme";
import type { AutoSkeletonProps } from "./types";

const AutoSkeleton: FC<AutoSkeletonProps> = ({ isLoading, children }) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  /* -------------------------------------------------------
     LOCK LOADING — start locked to prevent first-frame flash
  ------------------------------------------------------- */
  const [lockedLoading, setLockedLoading] = useState(true);

  /* Release ONLY after loading is false and committed */
  useLayoutEffect(() => {
    if (!isLoading) {
      setLockedLoading(false);
    }
  }, [isLoading]);

  /* -------------------------------------------------------
     iOS pulse animation (always running)
  ------------------------------------------------------- */
  const pulse = useRef(new Animated.Value(isDark ? 0.75 : 0.6)).current;

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: isDark ? 0.95 : 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: isDark ? 0.75 : 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    anim.start();
    return () => anim.stop();
  }, [pulse, isDark]);

  /* -------------------------------------------------------
     iOS
  ------------------------------------------------------- */
  if (Platform.OS === "ios") {
    if (!lockedLoading) {
      return <>{children}</>;
    }

    return (
      <View>
        {/* Children define layout but are NEVER visible */}
        <View style={{ opacity: 0 }}>{children}</View>

        {/* Skeleton fills exact content box */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: pulse,
              backgroundColor: isDark ? "#1f1f1f" : "#e5e5e5",
              borderRadius: 8,
              overflow: "hidden",
            },
          ]}
        />
      </View>
    );
  }

  /* -------------------------------------------------------
     Android (native skeleton already handles this)
  ------------------------------------------------------- */
  return (
    <AutoSkeletonView
      isLoading={isLoading}
      defaultRadius={8}
      animationType="pulse"
    >
      {children}
    </AutoSkeletonView>
  );
};

export default AutoSkeleton;
