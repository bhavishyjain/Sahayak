import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import apiCall from "./api";
import getUserAuth from "./userAuth";
import { NOTIFICATION_REGISTER_TOKEN_URL } from "../url";

/**
 * Requests notification permissions, retrieves the Expo push token,
 * and registers it with the backend. Safe to call multiple times —
 * the backend uses $addToSet so duplicates are ignored.
 * Fails silently so it never blocks the login / foreground flow.
 */
export async function registerPushToken() {
  try {
    if (Platform.OS === "web") return;

    // Ensure a logged-in user exists before hitting the authenticated endpoint
    const user = await getUserAuth();
    if (!user?.auth_token) return;

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData?.data;
    if (!pushToken) return;

    await apiCall({
      method: "POST",
      url: NOTIFICATION_REGISTER_TOKEN_URL,
      data: { pushToken },
    });
  } catch (error) {
    // Non-critical — log but don't surface to user
    console.warn("Push token registration failed:", error?.message);
  }
}
