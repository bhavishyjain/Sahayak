import { useFocusEffect, useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import { useUnreadNotificationCount } from "../utils/hooks/useNotifications";
import { useTheme } from "../utils/context/theme";

export default function NotificationBellButton({
  route = "/(app)/more/notification-history",
}) {
  const router = useRouter();
  const { colorScheme } = useTheme();
  const colors = useMemo(
    () => (colorScheme === "dark" ? darkColors : lightColors),
    [colorScheme],
  );
  const { data: unreadCount = 0, refetch } = useUnreadNotificationCount();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  return (
    <Pressable
      onPress={() => router.push(route)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Bell size={18} color={colors.textPrimary} />

        {unreadCount > 0 && (
          <View
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full items-center justify-center px-1"
            style={{ backgroundColor: colors.danger }}
          >
            <Text
              className="text-[10px] font-bold"
              style={{ color: colors.light }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
