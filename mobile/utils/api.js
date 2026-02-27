import { USER_AGENT_STRING } from "@/url";
import axios from "axios";
import getUserAuth from "./userAuth";

let cachedUser = null;
let userCachePromise = null;
let lastCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds cache

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
    return headers;
  } catch (error) {
    return {
      ...headers,
      "User-Agent": USER_AGENT_STRING,
    };
  }
};

const getAuthPayload = async (data = null) => {
  try {
    const user = await getCachedUser();
    if (user?.auth_token) {
      return {
        ...data,
        token: user.auth_token,
      };
    }
    return data;
  } catch (error) {
    return data;
  }
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
}) => {
  try {
    const authHeaders = auth
      ? {
        ...headers,
        Authorization: `Bearer ${auth.token}`,
        "User-Agent": USER_AGENT_STRING,
      }
      : await getAuthHeaders(headers);

    const isMultipart = authHeaders?.["Content-Type"]?.includes(
      "multipart/form-data",
    );

    let payload;

    if (isMultipart) {
      const formData = new FormData();
      const authPayload = await getAuthPayload(data);
      const flatData = flatten(authPayload);

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
    } else {
      payload = auth
        ? { ...data, token: auth.token }
        : await getAuthPayload(data);
    }

    const axiosConfig = {
      method,
      url,
      data: payload,
      params,
      headers: authHeaders,
      timeout: 30000,
      validateStatus: (status) => status < 500,
    };

    const response = await axios(axiosConfig);

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
    console.error("API Call Error:", error.message);
    console.error(error);
    throw error;
  }
};

export default apiCall;
