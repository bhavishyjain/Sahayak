import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import apiCall from "./api";
import getUserAuth from "./userAuth";
import { NOTIFICATION_REGISTER_TOKEN_URL } from "../url";

const PUSH_TOKEN_CACHE_KEY = "registered_push_token";
const ANDROID_DEFAULT_CHANNEL_ID = "default";
let hasLoggedPushSetupWarning = false;
let skipPushRegistrationForSession = false;
let pushNotificationsInitialized = false;

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim(),
  );
}

function getExpoProjectId() {
  const projectId =
    (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    Constants?.expoConfig?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    ""
    )
      .trim();

  return isUuid(projectId) ? projectId : "";
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBadge: true,
    shouldShowSound: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function initializePushNotifications() {
  try {
    if (pushNotificationsInitialized) return;
    pushNotificationsInitialized = true;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(
        ANDROID_DEFAULT_CHANNEL_ID,
        {
          name: "Default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FFCC00",
          sound: "default",
          showBadge: true,
          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
        },
      );
    }
  } catch (error) {
    pushNotificationsInitialized = false;
    console.warn(
      "Push notification initialization failed:",
      error?.message || "unknown error",
    );
  }
}

/**
 * Requests notification permissions, retrieves the Expo push token,
 * and registers it with the backend. Safe to call multiple times —
 * the backend uses $addToSet so duplicates are ignored.
 * Fails silently so it never blocks the login / foreground flow.
 */
export async function registerPushToken() {
  try {
    if (Platform.OS === "web") return;

    await initializePushNotifications();

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

    const projectId = getExpoProjectId();
    if (!projectId) {
      skipPushRegistrationForSession = true;
      hasLoggedPushSetupWarning = true;
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenData?.data;
    if (!pushToken) return;

    if (__DEV__) {
      console.log("Expo push token acquired:", pushToken);
    }

    // Skip registration if the token hasn't changed since last successful call
    const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_CACHE_KEY);
    if (cachedToken === pushToken) return;

    await apiCall({
      method: "POST",
      url: NOTIFICATION_REGISTER_TOKEN_URL,
      data: { pushToken },
    });

    await AsyncStorage.setItem(PUSH_TOKEN_CACHE_KEY, pushToken);

    if (__DEV__) {
      console.log("Expo push token registered with backend");
    }
  } catch (error) {
    const message = error?.message || "";
    const invalidProjectId =
      message.includes("projectId") &&
      (message.includes("Invalid uuid") || message.includes("VALIDATION_ERROR"));
    const missingAndroidFcmSetup =
      Platform.OS === "android" &&
      (message.includes("Default FirebaseApp is not initialized") ||
        message.includes("fcm-credentials"));

    if (invalidProjectId) {
      skipPushRegistrationForSession = true;
      hasLoggedPushSetupWarning = true;
      return;
    }

    if (missingAndroidFcmSetup) {
      skipPushRegistrationForSession = true;
      if (!hasLoggedPushSetupWarning && !__DEV__) {
        console.warn(
          "Push token registration disabled for this session: Android push requires Firebase/FCM setup (google-services.json + FCM credentials in Expo).",
        );
      }
      hasLoggedPushSetupWarning = true;
      return;
    }

    // Non-critical — log but don't surface to user
    console.warn("Push token registration failed:", message);
  }
}
