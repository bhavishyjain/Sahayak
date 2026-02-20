import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { darkColors, lightColors } from "../app/(app)/colors";
import { useTheme } from "../utils/context/theme";
import { useTranslation } from "../utils/i18n/LanguageProvider";

dayjs.extend(relativeTime);

export function SingleOrderBlock({ order }) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  const { t } = useTranslation();

  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/(app)/order/${order.unique_order_id}`)}
      android_ripple={{ color: colorScheme === "dark" ? "#333" : "#ddd" }}
      className="rounded-xl mb-4 p-4"
      style={{ backgroundColor: colors.backgroundSecondary }}
    >
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-xs" style={{ color: colors.textSecondary }}>
          {dayjs(order.updated_at).fromNow()}
        </Text>
        {order.ready_at && (
          <View
            className="px-4 py-2 rounded-full flex-row items-center gap-2"
            style={{ backgroundColor: colors.backgroundPrimary }}
          >
            <View className="relative">
              <View
                className="absolute w-3 h-3 rounded-full opacity-80 animate-ping-xl"
                style={{ backgroundColor: colors.success }}
              />
              <View
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors.success }}
              />
            </View>

            {/* LABEL */}
            <Text
              className="text-xs font-semibold"
              style={{ color: colors.textPrimary }}
            >
              {t("order.ready")}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row justify-between mb-2">
        <Text
          className="font-semibold flex-1"
          numberOfLines={1}
          style={{ color: colors.textPrimary }}
        >
          {order.restaurant.name}
        </Text>

        <Text className="font-bold" style={{ color: colors.textPrimary }}>
          #{order.unique_order_id.slice(-5)}
        </Text>
      </View>
      {order.orderstatus_id === 4 && (
        <View className="flex-row gap-2">
          <MapPin size={16} color={colors.primary} />

          <Text style={{ color: colors.textSecondary }}>
            {order.address.slice(0, 50)}
            {"..."}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
