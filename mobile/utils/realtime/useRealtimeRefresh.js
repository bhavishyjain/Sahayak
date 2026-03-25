import { useEffect } from "react";
import { addRealtimeListener } from "./socket";

export default function useRealtimeRefresh(eventTypes, handler) {
  useEffect(() => {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    const unsubscribers = types
      .filter(Boolean)
      .map((type) => addRealtimeListener(type, handler));

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [eventTypes, handler]);
}
