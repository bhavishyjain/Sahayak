import { Circle, Pause, Plane, Power } from "lucide-react-native";
import { Text, View } from "react-native";
import { darkColors, lightColors } from "../colors";
import { useTheme } from "../utils/context/theme";

export default function StatusPill({ user, status }) {
  const { colorScheme } = useTheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  let label = "Offline";
  let Icon = Power;
  let dotColorHex = "#EF4444"; // red-500
  let pulse = false;

  // If status prop is provided (for complaints), use complaint status logic
  if (status) {
    pulse = false; // No pulse animation for complaint statuses
    switch (status.toLowerCase()) {
      case "pending":
        label = "Pending";
        dotColorHex = "#F59E0B"; // amber-500
        break;
      case "assigned":
        label = "Assigned";
        dotColorHex = "#3B82F6"; // blue-500
        break;
      case "in-progress":
        label = "In Progress";
        dotColorHex = "#8B5CF6"; // purple-500
        break;
      case "resolved":
        label = "Resolved";
        dotColorHex = "#22C55E"; // green-500
        break;
      case "closed":
        label = "Closed";
        dotColorHex = "#6B7280"; // gray-500
        break;
      case "rejected":
        label = "Rejected";
        dotColorHex = "#EF4444"; // red-500
        break;
      default:
        label = status;
        dotColorHex = "#6B7280"; // gray-500
    }
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
      style={{ backgroundColor: colors.backgroundSecondary }}
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
