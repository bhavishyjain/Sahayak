import { Circle, Pause, Plane, Power } from "lucide-react-native";
import { Text, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import {
  getComplaintStatusMeta,
  getStatusColor,
} from "../data/complaintStatus";
import { useTheme } from "../utils/context/theme";

export default function StatusPill({ user, status }) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  let label = "Offline";
  let Icon = Power;
  let dotColorHex = "#EF4444"; // red-500
  let pulse = false;
  let backgroundColor = colors.backgroundSecondary;

  // If status prop is provided (for complaints), use complaint status logic
  if (status) {
    pulse = false; // No pulse animation for complaint statuses
    const statusMeta = getComplaintStatusMeta(status);
    const statusColor = getStatusColor(status, colors) ?? colors.muted;
    label = statusMeta?.fallbackLabel ?? String(status);
    dotColorHex = statusColor;
    backgroundColor = `${statusColor}22`;
  } else if (user) {
    // Original user online/offline status logic
    const schedule = user?.data?.schedule_data;

    if (schedule?.on_vacation) {
      label = "Vacation";
      Icon = Plane;
      dotColorHex = "#FBBF24"; // yellow-400
      pulse = false;
    } else if (schedule?.is_schedulable) {
      if (schedule?.schedule_paused) {
        label = "Paused";
        Icon = Pause;
        dotColorHex = "#FB923C"; // orange-400
        pulse = false;
      } else {
        if (user?.data?.status === 1) {
          label = "Online";
          Icon = Circle;
          dotColorHex = "#22C55E"; // green-500
          pulse = true; // 🔥 animate only when online
        } else {
          label = "Offline";
          Icon = Power;
          dotColorHex = "#EF4444"; // red-500
          pulse = false;
        }
      }
    } else {
      if (user?.data?.status === 1) {
        label = "Online";
        Icon = Circle;
        dotColorHex = "#22C55E"; // green-500
        pulse = true;
      } else {
        label = "Offline";
        Icon = Power;
        dotColorHex = "#EF4444"; // red-500
        pulse = false;
      }
    }
  }

  return (
    <View
      className="px-4 py-2 rounded flex-row items-center gap-2"
      style={{ backgroundColor }}
    >
      {/* 🔵 STATUS DOT */}
      <View className="relative">
        {pulse && (
          <View
            className="absolute w-3 h-3 rounded-full opacity-40 animate-ping-xl"
            style={{ backgroundColor: dotColorHex }}
          />
        )}
        <View
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: dotColorHex }}
        />
      </View>

      {/* LABEL */}
      <Text
        className="text-xs font-semibold"
        style={{ color: colors.textPrimary }}
      >
        {label}
      </Text>
    </View>
  );
}
