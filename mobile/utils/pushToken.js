import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiCall from "./api";
import getUserAuth from "./userAuth";
import { NOTIFICATION_REGISTER_TOKEN_URL } from "../url";

const PUSH_TOKEN_CACHE_KEY = "registered_push_token";
let hasLoggedPushSetupWarning = false;
let skipPushRegistrationForSession = false;

/**
 * Requests notification permissions, retrieves the Expo push token,
 * and registers it with the backend. Safe to call multiple times —
 * the backend uses $addToSet so duplicates are ignored.
 * Fails silently so it never blocks the login / foreground flow.
 */
export async function registerPushToken() {
  try {
    if (Platform.OS === "web") return;

    if (skipPushRegistrationForSession) return;

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

    // Skip registration if the token hasn't changed since last successful call
    const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_CACHE_KEY);
    if (cachedToken === pushToken) return;

    await apiCall({
      method: "POST",
      url: NOTIFICATION_REGISTER_TOKEN_URL,
      data: { pushToken },
    });

    await AsyncStorage.setItem(PUSH_TOKEN_CACHE_KEY, pushToken);
  } catch (error) {
    const message = error?.message || "";
    const missingAndroidFcmSetup =
      Platform.OS === "android" &&
      (message.includes("Default FirebaseApp is not initialized") ||
        message.includes("fcm-credentials"));

    if (missingAndroidFcmSetup) {
      skipPushRegistrationForSession = true;
      if (!hasLoggedPushSetupWarning) {
        console.warn(
          "Push token registration disabled for this session: Android push requires Firebase/FCM setup (google-services.json + FCM credentials in Expo).",
        );
        hasLoggedPushSetupWarning = true;
      }
      return;
    }

    // Non-critical — log but don't surface to user
    console.warn("Push token registration failed:", message);
  }
}
