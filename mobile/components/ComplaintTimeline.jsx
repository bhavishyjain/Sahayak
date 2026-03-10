import {
  CheckCircle,
  Clock,
  UserCheck,
  Wrench,
  ClipboardCheck,
  RotateCcw,
  XCircle,
  AlertCircle,
} from "lucide-react-native";
import { Text, View } from "react-native";

const STATUS_CONFIG = {
  pending: {
    Icon: Clock,
    color: "#F59E0B",
    bg: "#F59E0B22",
    label: "Pending",
  },
  assigned: {
    Icon: UserCheck,
    color: "#3B82F6",
    bg: "#3B82F622",
    label: "Assigned",
  },
  "in-progress": {
    Icon: Wrench,
    color: "#8B5CF6",
    bg: "#8B5CF622",
    label: "In Progress",
  },
  "pending-approval": {
    Icon: ClipboardCheck,
    color: "#06B6D4",
    bg: "#06B6D422",
    label: "Pending Approval",
  },
  "needs-rework": {
    Icon: RotateCcw,
    color: "#F97316",
    bg: "#F9731622",
    label: "Needs Rework",
  },
  resolved: {
    Icon: CheckCircle,
    color: "#10B981",
    bg: "#10B98122",
    label: "Resolved",
  },
  cancelled: {
    Icon: XCircle,
    color: "#6B7280",
    bg: "#6B728022",
    label: "Cancelled",
  },
};

function getStatusConfig(status) {
  return (
    STATUS_CONFIG[status?.toLowerCase()] ?? {
      Icon: AlertCircle,
      color: "#6B7280",
      bg: "#6B728022",
      label: status ?? "Unknown",
    }
  );
}

function resolveActor(updatedBy) {
  if (!updatedBy) return null;
  if (typeof updatedBy === "string") return updatedBy;
  if (typeof updatedBy === "object") {
    return updatedBy.fullName ?? updatedBy.username ?? null;
  }
  return null;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ComplaintTimeline({ history, colors }) {
  if (!history || history.length === 0) return null;

  return (
    <View>
      {history.map((item, index) => {
        const isLast = index === history.length - 1;
        const cfg = getStatusConfig(item.status);
        const { Icon } = cfg;
        const actor = resolveActor(item.updatedBy);

        return (
          <View key={index} className="flex-row">
            {/* Left: icon + connector line */}
            <View className="items-center" style={{ width: 36 }}>
              {/* Connector line above (skip for first) */}
              {index > 0 && (
                <View
                  style={{
                    width: 2,
                    height: 10,
                    backgroundColor: colors.border,
                  }}
                />
              )}
              {/* Icon circle */}
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: cfg.bg,
                  borderWidth: 1.5,
                  borderColor: cfg.color,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon size={15} color={cfg.color} />
              </View>
              {/* Connector line below (skip for last) */}
              {!isLast && (
                <View
                  style={{
                    flex: 1,
                    width: 2,
                    minHeight: 16,
                    backgroundColor: colors.border,
                  }}
                />
              )}
            </View>

            {/* Right: content */}
            <View
              className="flex-1 ml-3"
              style={{
                paddingBottom: isLast ? 0 : 16,
                paddingTop: index > 0 ? 10 : 0,
              }}
            >
              {/* Status label + timestamp */}
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: cfg.color }}
                >
                  {cfg.label}
                </Text>
                <Text className="text-xs" style={{ color: colors.textMuted }}>
                  {formatDate(item.timestamp)}
                </Text>
              </View>

              {/* Note */}
              {item.note && (
                <Text
                  className="text-xs mt-0.5"
                  style={{ color: colors.textSecondary }}
                >
                  {item.note}
                </Text>
              )}

              {/* Actor badge */}
              {actor && (
                <View
                  className="flex-row items-center mt-1 self-start px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.backgroundSecondary }}
                >
                  <Text className="text-xs" style={{ color: colors.textMuted }}>
                    {actor}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
