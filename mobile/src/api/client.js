import Constants from "expo-constants";

const fallbackBaseUrl = "http://localhost:3000/api";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  fallbackBaseUrl;

async function request(path, { method = "GET", token, body } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export const api = {
  health: () => request("/health"),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  register: (payload) =>
    request("/auth/register", { method: "POST", body: payload }),
  me: (token) => request("/auth/me", { token }),
  dashboardSummary: (token) => request("/dashboard/summary", { token }),
  createComplaint: (token, payload) => {
    const formData = new FormData();
    formData.append("title", payload.title);
    formData.append("description", payload.description);
    formData.append("department", payload.department);
    formData.append("locationName", payload.locationName);
    formData.append("priority", payload.priority);

    if (payload.coordinates) {
      formData.append("coordinates", JSON.stringify(payload.coordinates));
    }

    if (payload.imageUri) {
      const fileName = payload.imageUri.split("/").pop() || `complaint-${Date.now()}.jpg`;
      formData.append("image", {
        uri: payload.imageUri,
        type: "image/jpeg",
        name: fileName,
      });
    }

    return request("/complaints", { method: "POST", token, body: formData });
  },
  myComplaints: (token) => request("/complaints", { token }),
  chatMessage: (message, conversationHistory = [], token, extra = {}) =>
    request("/chat/message", {
      method: "POST",
      token,
      body: { message, conversationHistory, ...extra },
    }),
  speechToText: async (audioUri, token) => {
    const formData = new FormData();
    formData.append("audio", {
      uri: audioUri,
      type: "audio/m4a",
      name: `recording-${Date.now()}.m4a`,
    });
    return request("/chat/speech-to-text", {
      method: "POST",
      token,
      body: formData,
    });
  },
  registerPushToken: (token, pushToken) =>
    request("/notifications/register-token", {
      method: "POST",
      token,
      body: { pushToken },
    }),
  sendTestNotification: (token) =>
    request("/notifications/test", { method: "POST", token }),
};
