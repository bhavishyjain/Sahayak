import { useMemo } from "react";
import { Text, View } from "react-native";
import {
  formatStatusLabel,
  getStatusBackgroundColor,
  getStatusColor,
  getStatusIcon,
} from "../data/complaintStatus";

function getStatusConfig(status, colors, t) {
  const color = getStatusColor(status, colors) ?? colors.muted;
  return {
    Icon: getStatusIcon(status),
    color,
    bg: getStatusBackgroundColor(status, colors) ?? colors.backgroundSecondary,
    label: formatStatusLabel(t, status),
  };
}

function resolveActor(updatedBy) {
  if (!updatedBy) return null;
  if (typeof updatedBy === "string") {
    const value = updatedBy.trim();
    if (/^[a-f0-9]{24}$/i.test(value)) return null;
    return value;
  }
  if (typeof updatedBy === "object") {
    return updatedBy.fullName ?? updatedBy.username ?? null;
  }
  return null;
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getTimelineTimestamp(item) {
  return (
    item?.timestamp || item?.updatedAt || item?.createdAt || item?.at || null
  );
}

function toMinuteKey(timestamp) {
  if (!timestamp) return "none";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return String(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function ComplaintTimeline({ history, colors, t }) {
  if (!history || history.length === 0) return null;

  const timelineItems = useMemo(() => {
    const normalized = history.map((item) => ({
      ...item,
      __timestamp: getTimelineTimestamp(item),
    }));

    const compact = [];
    for (const item of normalized) {
      const prev = compact[compact.length - 1];
      if (!prev) {
        compact.push(item);
        continue;
      }

      const sameStatus =
        String(prev.status || "") === String(item.status || "");
      const sameNote = String(prev.note || "") === String(item.note || "");
      const sameActor =
        String(resolveActor(prev.updatedBy) || "") ===
        String(resolveActor(item.updatedBy) || "");
      const sameMinute =
        toMinuteKey(prev.__timestamp) === toMinuteKey(item.__timestamp);

      if (sameStatus && sameNote && sameActor && sameMinute) {
        continue;
      }

      compact.push(item);
    }

    return compact;
  }, [history]);

  return (
    <View>
      {timelineItems.map((item, index) => {
        const isLast = index === timelineItems.length - 1;
        const cfg = getStatusConfig(item.status, colors, t);
        const { Icon } = cfg;
        const actor = resolveActor(item.updatedBy);
        const timestamp = item.__timestamp;

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
              {/* Status label */}
              <View className="flex-row items-center">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: cfg.color }}
                >
                  {cfg.label}
                </Text>
              </View>

              {/* Date + time */}
              {!!timestamp && (
                <Text
                  className="text-xs mt-0.5"
                  style={{ color: colors.textSecondary }}
                >
                  {formatDate(timestamp)}
                </Text>
              )}

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
