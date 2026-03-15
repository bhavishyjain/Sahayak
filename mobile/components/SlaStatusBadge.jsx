import { AlertTriangle, ChevronUp, Clock } from "lucide-react-native";
import { Text, View } from "react-native";
import { getSlaCountdown } from "../utils/complaintHelpers";

/**
 * A compact badge row showing SLA countdown/overdue status and escalation level.
 *
 * Props:
 *   sla          – the complaint.sla object from the API
 *   style        – optional extra style for the container View
 */
export default function SlaStatusBadge({ sla, style }) {
  if (!sla) return null;

  const countdown = getSlaCountdown(sla.dueDate);
  const isOverdue = sla.isOverdue || countdown?.isOverdue || false;
  const escalationLevel = sla.escalationLevel || 0;

  // Nothing to show if there is no due date and no escalation
  if (!countdown && escalationLevel === 0) return null;

  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, style]}
    >
      {/* Overdue or countdown badge */}
      {isOverdue ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: "#EF444422",
          }}
        >
          <AlertTriangle size={10} color="#EF4444" />
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#EF4444",
              marginLeft: 3,
            }}
          >
            OVERDUE
          </Text>
        </View>
      ) : countdown ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: countdown.isCritical
              ? "#EF444422"
              : countdown.isUrgent
                ? "#F59E0B22"
                : "#10B98122",
          }}
        >
          <Clock
            size={10}
            color={
              countdown.isCritical
                ? "#EF4444"
                : countdown.isUrgent
                  ? "#F59E0B"
                  : "#10B981"
            }
          />
          <Text
            style={{
              fontSize: 10,
              fontWeight: "600",
              marginLeft: 3,
              color: countdown.isCritical
                ? "#EF4444"
                : countdown.isUrgent
                  ? "#F59E0B"
                  : "#10B981",
            }}
          >
            {countdown.text}
          </Text>
        </View>
      ) : null}

      {/* Escalation level badge */}
      {escalationLevel > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 7,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: "#F9731622",
          }}
        >
          <ChevronUp size={10} color="#F97316" />
          <Text
            style={{
              fontSize: 10,
              fontWeight: "700",
              color: "#F97316",
              marginLeft: 2,
            }}
          >
            ESC L{escalationLevel}
          </Text>
        </View>
      )}
    </View>
  );
}
