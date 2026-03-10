import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/**
 * Returns { isOnline, isConnected }.
 * isOnline = true when the device has a working internet connection.
 * isConnected = true when any network interface is up (but may not have internet).
 */
export function useNetworkStatus() {
  const [state, setState] = useState({ isOnline: true, isConnected: true });

  useEffect(() => {
    // Get current state immediately
    NetInfo.fetch().then((s) => {
      setState({
        isConnected: s.isConnected ?? true,
        isOnline: s.isInternetReachable ?? s.isConnected ?? true,
      });
    });

    // Subscribe to changes
    const unsub = NetInfo.addEventListener((s) => {
      setState({
        isConnected: s.isConnected ?? true,
        isOnline: s.isInternetReachable ?? s.isConnected ?? true,
      });
    });

    return unsub;
  }, []);

  return state;
}
