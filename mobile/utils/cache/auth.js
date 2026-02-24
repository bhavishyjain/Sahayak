import AsyncStorage from "@react-native-async-storage/async-storage";

let cachedToken = null;

/**
 * Load token once at app startup
 */
export const initAuthToken = async () => {
  try {
    const raw = await AsyncStorage.getItem("user");
    if (!raw) return null;

    const user = JSON.parse(raw);
    cachedToken = user?.auth_token ?? null;

    return cachedToken;
  } catch (e) {
    cachedToken = null;
    return null;
  }
};

/**
 * Get token from memory (FAST, SAFE)
 */
export const getCachedToken = () => cachedToken;

/**
 * Update cache after login / refresh
 */
export const setCachedToken = (token) => {
  cachedToken = token;
};

/**
 * Clear on logout
 */
export const clearCachedToken = async () => {
  cachedToken = null;
  await AsyncStorage.removeItem("user");
};
