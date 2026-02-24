import { GET_ME_URL } from "@/url";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import apiCall from "./api";
import { initAuthToken } from "./cache/auth";

let ongoingGetUser = null;

export default async function getUserAuth() {
  if (ongoingGetUser) {
    return ongoingGetUser;
  }

  try {
    ongoingGetUser = (async () => {
      let user = null;
      if (Platform.OS === "web") {
        user = localStorage.getItem("user");
      } else {
        user = await AsyncStorage.getItem("user");
      }
      return user ? JSON.parse(user) : null;
    })();

    const result = await ongoingGetUser;
    ongoingGetUser = null;
    return result;
  } catch (error) {
    console.error("getUserAuth error:", error?.message);
    ongoingGetUser = null;
    return null;
  }
}

export async function setUserAuth(user) {
  if (Platform.OS === "web") {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("auth_token", user.auth_token);
  } else {
    await AsyncStorage.setItem("user", JSON.stringify(user));
    await AsyncStorage.setItem("auth_token", user.auth_token);
  }
  await initAuthToken();
}

export async function clearUserAuth() {
  // Clear AsyncStorage/localStorage
  if (Platform.OS === "web") {
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("background_user_id");
  } else {
    await AsyncStorage.removeItem("user");
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("background_user_id");
  }

  // Note: QueryClient cache clearing is handled in logout.jsx
}

export async function updateUserInfo() {
  const res = await apiCall({
    method: "GET",
    url: GET_ME_URL,
  });
  const userData = res.data.user;
  if (userData) {
    setUserAuth(userData);
  }
  return res;
}

export async function updateUserInfoViaApi(partialUpdate) {
  if (!partialUpdate || typeof partialUpdate !== "object") {
    throw new Error("updateUserInfoViaApi requires an object");
  }

  let user = getUserAuth();

  if (!user) {
    throw new Error("No authenticated user found");
  }

  const updatedUser = {
    ...user,
    ...partialUpdate,
  };

  if (Platform.OS === "web") {
    localStorage.setItem("user", JSON.stringify(updatedUser));
  } else {
    await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
  }

  return updatedUser;
}
