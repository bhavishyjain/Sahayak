import { USER_AGENT_STRING, REFRESH_URL } from "@/url";
import axios from "axios";
import { router } from "expo-router";
import getUserAuth, { setUserAuth, clearUserAuth } from "./userAuth";
import { markAccountDeactivated } from "./accountStatus";

let cachedUser = null;
let userCachePromise = null;
let lastCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds cache

// Track in-flight refresh to prevent parallel refresh storms
let refreshPromise = null;

// Ensure session-expiry logout flow runs once when many requests fail together
let sessionExpiryPromise = null;
let sessionExpiredAt = 0;
const SESSION_EXPIRY_COOLDOWN_MS = 4000;

// Set during intentional logout to suppress spurious 401 handling
let isLoggingOut = false;

/** Call before clearUserAuth() to drop the in-memory token cache and
 *  prevent "Session expired" noise from still-mounted screens. */
export function clearApiCache() {
  cachedUser = null;
  lastCacheTime = 0;
  isLoggingOut = true;
  // Reset flag after a short delay so the cache is usable again on next login
  setTimeout(() => {
    isLoggingOut = false;
  }, 3000);
}

async function handleSessionExpired(response) {
  if (!sessionExpiryPromise) {
    sessionExpiryPromise = (async () => {
      clearApiCache();
      await clearUserAuth();
      router.replace("/(app)/(auth)/login");
    })().finally(() => {
      sessionExpiredAt = Date.now();
      sessionExpiryPromise = null;
    });
  }

  await sessionExpiryPromise;
  const e = new Error("Session expired. Please log in again.");
  e.name = "SessionExpiredError";
  e.response = response;
  throw e;
}

async function attemptTokenRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const user = await getUserAuth();
      if (!user?.refresh_token) return null;

      const resp = await axios.post(
        REFRESH_URL,
        { refreshToken: user.refresh_token },
        { headers: { "User-Agent": USER_AGENT_STRING }, timeout: 10000 },
      );
      const newToken = resp.data?.token ?? resp.data?.data?.token;
      const newRefresh =
        resp.data?.refreshToken ?? resp.data?.data?.refreshToken;
      if (!newToken) return null;

      const updated = { ...user, auth_token: newToken, token: newToken };
      if (newRefresh) updated.refresh_token = newRefresh;
      await setUserAuth(updated);
      try {
        const { reconnectRealtime } = require("./realtime/socket");
        await reconnectRealtime();
      } catch (_error) {
      }
      // Bust the cache so next apiCall picks up the new token
      cachedUser = updated;
      lastCacheTime = Date.now();
      return newToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const getCachedUser = async () => {
  if (cachedUser && Date.now() - lastCacheTime < CACHE_TTL) {
    return cachedUser;
  }

  if (userCachePromise) {
    return userCachePromise;
  }

  userCachePromise = Promise.race([
    getUserAuth(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("getUserAuth timeout")), 5000),
    ),
  ])
    .then((user) => {
      cachedUser = user;
      lastCacheTime = Date.now();
      userCachePromise = null;
      return user;
    })
    .catch((error) => {
      console.error("getUserAuth failed:", error?.message);
      userCachePromise = null;
      return cachedUser;
    });

  return userCachePromise;
};

const getAuthHeaders = async (headers = {}) => {
  try {
    const user = await getCachedUser();
    if (user?.auth_token) {
      return {
        ...headers,
        Authorization: `Bearer ${user.auth_token}`,
        "User-Agent": USER_AGENT_STRING,
      };
    }
    return {
      ...headers,
      "User-Agent": USER_AGENT_STRING,
    };
  } catch (_error) {
    return {
      ...headers,
      "User-Agent": USER_AGENT_STRING,
    };
  }
};

const isNativeFormData = (value) => {
  if (!value || typeof value !== "object") return false;
  if (typeof FormData !== "undefined" && value instanceof FormData) return true;
  return (
    typeof value.append === "function" &&
    (typeof value.getParts === "function" || Array.isArray(value._parts))
  );
};

// flatten stays the same
export const flatten = (obj, prefix = "") => {
  const result = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const prefixed = prefix ? `${prefix}[${key}]` : key;

    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      !(value?.uri && value?.type)
    ) {
      Object.assign(result, flatten(value, prefixed));
    } else if (Array.isArray(value)) {
      value.forEach((val, i) => {
        Object.assign(result, flatten(val, `${prefixed}[${i}]`));
      });
    } else {
      result[prefixed] = value;
    }
  }
  return result;
};

const apiCall = async ({
  method,
  url,
  data = null,
  params = undefined,
  headers = {},
  auth = null,
  responseType = undefined,
  suppressErrorLog = false,
}) => {
  // Silently abort in-flight calls fired after intentional logout
  if (isLoggingOut) {
    const e = new Error("Logged out");
    e.name = "LogoutError";
    throw e;
  }

  // If session was just expired, avoid repeated refresh/logout attempts.
  if (Date.now() - sessionExpiredAt < SESSION_EXPIRY_COOLDOWN_MS) {
    const e = new Error("Session expired. Please log in again.");
    e.name = "SessionExpiredError";
    throw e;
  }
  try {
    const authHeaders = auth
      ? {
          ...headers,
          Authorization: `Bearer ${auth.token}`,
          "User-Agent": USER_AGENT_STRING,
        }
      : await getAuthHeaders(headers);

    const contentType =
      authHeaders?.["Content-Type"] || authHeaders?.["content-type"] || "";
    const isMultipart =
      typeof contentType === "string" &&
      contentType.includes("multipart/form-data");

    let payload;

    if (isMultipart) {
      if (isNativeFormData(data)) {
        payload = data;
      } else {
        const formData = new FormData();
        const flatData = flatten(data);

        Object.entries(flatData).forEach(([key, value]) => {
          if (value && typeof value === "object" && value.uri) {
            formData.append(key, {
              uri: value.uri,
              name: value.name || "image.webp",
              type: value.type || "image/webp",
            });
          } else {
            formData.append(key, String(value ?? ""));
          }
        });

        payload = formData;
      }
    } else {
      payload = data;
    }

    const axiosConfig = {
      method,
      url,
      data: payload,
      params,
      headers: authHeaders,
      responseType,
      timeout: 30000,
      validateStatus: (status) => status < 500,
    };

    const response = await axios(axiosConfig);

    // On 401, attempt a single token refresh then retry once
    if (response.status === 401 && !auth) {
      const newToken = await attemptTokenRefresh();
      if (newToken) {
        const retryHeaders = {
          ...authHeaders,
          Authorization: `Bearer ${newToken}`,
        };
        const retryResponse = await axios({
          ...axiosConfig,
          headers: retryHeaders,
        });
        if (retryResponse.status === 401) {
          // Refresh didn't help — force logout once
          await handleSessionExpired(retryResponse);
        }
        if (retryResponse.status >= 400) {
          const e = new Error(
            retryResponse.data?.message || `API Error: ${retryResponse.status}`,
          );
          e.response = retryResponse;
          throw e;
        }
        const retryRaw = retryResponse.data;
        return {
          ...retryResponse,
          data:
            retryRaw && typeof retryRaw === "object" && "data" in retryRaw
              ? retryRaw.data
              : retryRaw,
          rawData: retryRaw,
          success: retryRaw?.success ?? true,
          message: retryRaw?.message,
        };
      } else {
        // No refresh token or refresh failed — force logout once
        await handleSessionExpired(response);
      }
    }

    if (
      response.status === 403 &&
      response.data?.details?.accountDeactivated === true
    ) {
      await markAccountDeactivated();
      const error = new Error(
        response.data?.message || "This account has been deactivated",
      );
      error.response = response;
      throw error;
    }

    if (response.status >= 400) {
      const error = new Error(
        response.data?.message || `API Error: ${response.status}`,
      );
      error.response = response;
      throw error;
    }

    const rawData = response.data;
    const normalizedData =
      rawData && typeof rawData === "object" && "data" in rawData
        ? rawData.data
        : rawData;

    return {
      ...response,
      data: normalizedData,
      rawData,
      success:
        rawData && typeof rawData === "object" && "success" in rawData
          ? rawData.success
          : true,
      message:
        rawData && typeof rawData === "object" && "message" in rawData
          ? rawData.message
          : undefined,
    };
  } catch (error) {
    const isExpectedLogoutError =
      error?.name === "LogoutError" ||
      error?.name === "SessionExpiredError" ||
      error?.message === "Session expired. Please log in again.";

    if (!suppressErrorLog && !isExpectedLogoutError) {
      console.error("API Call Error:", error.message);
      console.error(error);
    }
    throw error;
  }
};

export default apiCall;
