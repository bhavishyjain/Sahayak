import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { API_BASE } from "../../url";

let socket = null;
let connectPromise = null;
let reconnectTimer = null;
let shouldReconnect = true;

const listeners = new Map();
const subscribedComplaintIds = new Set();

function getWebSocketBaseUrl() {
  const normalizedApiBase = String(API_BASE || "").replace(/\/+$/, "");
  const serverBase = normalizedApiBase.replace(/\/api$/, "");

  if (!serverBase) return "";
  if (serverBase.startsWith("https://")) {
    return serverBase.replace(/^https:\/\//, "wss://");
  }
  if (serverBase.startsWith("http://")) {
    return serverBase.replace(/^http:\/\//, "ws://");
  }
  return serverBase;
}

async function getRealtimeToken() {
  try {
    const rawUser =
      Platform.OS === "web"
        ? localStorage.getItem("user")
        : await AsyncStorage.getItem("user");
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    return parsedUser?.auth_token || parsedUser?.token || "";
  } catch (_error) {
    return "";
  }
}

function emitLocal(type, payload = {}) {
  const handlers = listeners.get(type);
  if (!handlers?.size) return;

  handlers.forEach((handler) => {
    try {
      handler(payload);
    } catch (_error) {
    }
  });
}

function sendMessage(type, payload = {}) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify({ type, payload }));
  return true;
}

function scheduleReconnect() {
  if (!shouldReconnect || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    ensureRealtimeConnection().catch(() => {});
  }, 3000);
}

export async function ensureRealtimeConnection() {
  if (socket?.readyState === WebSocket.OPEN) return socket;
  if (socket?.readyState === WebSocket.CONNECTING) return connectPromise;
  if (connectPromise) return connectPromise;

  const token = await getRealtimeToken();
  const baseUrl = getWebSocketBaseUrl();
  if (!token || !baseUrl) return null;

  connectPromise = new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(
        `${baseUrl}/realtime?token=${encodeURIComponent(token)}`,
      );
      socket = ws;

      ws.onopen = () => {
        connectPromise = null;
        subscribedComplaintIds.forEach((complaintId) => {
          sendMessage("subscribe-complaint", { complaintId });
        });
        emitLocal("connection", { state: "open" });
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event?.data || "{}");
          if (!parsed?.type) return;
          emitLocal(parsed.type, parsed.payload);
        } catch (_error) {
        }
      };

      ws.onerror = () => {
        emitLocal("connection", { state: "error" });
      };

      ws.onclose = () => {
        if (socket === ws) {
          socket = null;
        }
        connectPromise = null;
        emitLocal("connection", { state: "closed" });
        scheduleReconnect();
      };
    } catch (error) {
      connectPromise = null;
      reject(error);
    }
  });

  return connectPromise;
}

export function disconnectRealtime() {
  shouldReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
  connectPromise = null;
}

export async function reconnectRealtime() {
  shouldReconnect = true;
  if (socket) {
    socket.close();
  }
  socket = null;
  connectPromise = null;
  return ensureRealtimeConnection();
}

export async function subscribeToComplaint(complaintId) {
  const normalizedComplaintId = String(complaintId || "").trim();
  if (!normalizedComplaintId) return;

  subscribedComplaintIds.add(normalizedComplaintId);
  await ensureRealtimeConnection();
  sendMessage("subscribe-complaint", { complaintId: normalizedComplaintId });
}

export function unsubscribeFromComplaint(complaintId) {
  const normalizedComplaintId = String(complaintId || "").trim();
  if (!normalizedComplaintId) return;

  subscribedComplaintIds.delete(normalizedComplaintId);
  sendMessage("unsubscribe-complaint", {
    complaintId: normalizedComplaintId,
  });
}

export function addRealtimeListener(type, handler) {
  if (!listeners.has(type)) {
    listeners.set(type, new Set());
  }
  listeners.get(type).add(handler);

  return () => {
    const handlers = listeners.get(type);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      listeners.delete(type);
    }
  };
}
