const jwt = require("jsonwebtoken");
const { URL } = require("url");
const User = require("../models/User");
const Complaint = require("../models/Complaint");
const { canAccessComplaint } = require("../policies/complaintPolicy");

let WebSocketServer = null;
try {
  ({ WebSocketServer } = require("ws"));
} catch (_error) {
  WebSocketServer = null;
}

let wss = null;
const socketsByUserId = new Map();
const socketsByComplaintId = new Map();
const socketMeta = new WeakMap();

function addSocketToRoom(map, key, socket) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return;
  if (!map.has(normalizedKey)) {
    map.set(normalizedKey, new Set());
  }
  map.get(normalizedKey).add(socket);
}

function removeSocketFromRoom(map, key, socket) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey || !map.has(normalizedKey)) return;
  const sockets = map.get(normalizedKey);
  sockets.delete(socket);
  if (sockets.size === 0) {
    map.delete(normalizedKey);
  }
}

function send(socket, type, payload = {}) {
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ type, payload }));
}

function broadcast(sockets, type, payload = {}) {
  if (!sockets?.size) return;
  sockets.forEach((socket) => send(socket, type, payload));
}

async function authenticateSocketToken(token) {
  if (!token || !process.env.JWT_SECRET) return null;

  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(payload.userId).select(
    "_id role username fullName email phone department isActive tokenValidFrom",
  );
  if (!user || !user.isActive) return null;

  if (
    user.tokenValidFrom &&
    Math.floor(user.tokenValidFrom.getTime() / 1000) > payload.iat
  ) {
    return null;
  }

  return {
    _id: user._id,
    id: user._id,
    role: user.role,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    department: user.department,
  };
}

async function subscribeComplaint(socket, complaintId) {
  const normalizedComplaintId = String(complaintId || "").trim();
  if (!normalizedComplaintId) {
    send(socket, "error", { message: "complaintId is required" });
    return;
  }

  const complaint = await Complaint.findById(normalizedComplaintId).select(
    "userId department assignedWorkers",
  );
  if (!complaint) {
    send(socket, "error", { message: "Complaint not found" });
    return;
  }

  const allowed = await canAccessComplaint(socket.user, complaint);
  if (!allowed) {
    send(socket, "error", { message: "Forbidden" });
    return;
  }

  const meta = socketMeta.get(socket);
  meta.complaintIds.add(normalizedComplaintId);
  addSocketToRoom(socketsByComplaintId, normalizedComplaintId, socket);
  send(socket, "subscribed", { complaintId: normalizedComplaintId });
}

function unsubscribeComplaint(socket, complaintId) {
  const normalizedComplaintId = String(complaintId || "").trim();
  if (!normalizedComplaintId) return;

  const meta = socketMeta.get(socket);
  meta.complaintIds.delete(normalizedComplaintId);
  removeSocketFromRoom(socketsByComplaintId, normalizedComplaintId, socket);
  send(socket, "unsubscribed", { complaintId: normalizedComplaintId });
}

async function handleSocketMessage(socket, raw) {
  try {
    const message = JSON.parse(String(raw || ""));
    const { type, payload = {} } = message || {};

    switch (type) {
      case "subscribe-complaint":
        await subscribeComplaint(socket, payload.complaintId);
        break;
      case "unsubscribe-complaint":
        unsubscribeComplaint(socket, payload.complaintId);
        break;
      case "ping":
        send(socket, "pong", { ts: Date.now() });
        break;
      default:
        send(socket, "error", { message: "Unsupported realtime event" });
    }
  } catch (_error) {
    send(socket, "error", { message: "Invalid realtime payload" });
  }
}

function cleanupSocket(socket) {
  const meta = socketMeta.get(socket);
  if (!meta) return;

  removeSocketFromRoom(socketsByUserId, meta.userId, socket);
  meta.complaintIds.forEach((complaintId) => {
    removeSocketFromRoom(socketsByComplaintId, complaintId, socket);
  });
  socketMeta.delete(socket);
}

function setupRealtime(server) {
  if (!WebSocketServer) {
    console.warn("Realtime disabled: ws package is not installed");
    return null;
  }

  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host}`);
      if (requestUrl.pathname !== "/realtime") {
        return;
      }

      const token = requestUrl.searchParams.get("token");
      const user = await authenticateSocketToken(token);
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.user = user;
        wss.emit("connection", ws, req);
      });
    } catch (_error) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (socket) => {
    const userId = String(socket.user?._id || "");
    socketMeta.set(socket, { userId, complaintIds: new Set() });
    addSocketToRoom(socketsByUserId, userId, socket);

    send(socket, "connected", {
      userId,
      role: socket.user?.role,
      department: socket.user?.department || null,
    });

    socket.on("message", (raw) => {
      handleSocketMessage(socket, raw).catch(() => {
        send(socket, "error", { message: "Realtime handler failed" });
      });
    });
    socket.on("close", () => cleanupSocket(socket));
    socket.on("error", () => cleanupSocket(socket));
  });

  return wss;
}

function collectTargetSockets({ complaintId, userIds = [] } = {}) {
  const targets = new Set();

  if (complaintId && socketsByComplaintId.has(String(complaintId))) {
    socketsByComplaintId.get(String(complaintId)).forEach((socket) => {
      targets.add(socket);
    });
  }

  userIds.forEach((userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId || !socketsByUserId.has(normalizedUserId)) return;
    socketsByUserId.get(normalizedUserId).forEach((socket) => {
      targets.add(socket);
    });
  });

  return targets;
}

async function collectComplaintParticipantIds(complaint) {
  const participantIds = new Set();

  if (complaint?.userId) {
    participantIds.add(String(complaint.userId));
  }

  (complaint?.assignedWorkers || []).forEach((assignment) => {
    if (assignment?.workerId) {
      participantIds.add(String(assignment.workerId));
    }
  });

  if (complaint?.department) {
    const heads = await User.find({
      role: "head",
      department: complaint.department,
    }).select("_id");
    heads.forEach((head) => participantIds.add(String(head._id)));
  }

  return [...participantIds];
}

async function emitComplaintUpdated({
  complaint,
  actorId = null,
  event = "complaint-updated",
  extra = {},
} = {}) {
  if (!complaint) return;

  const complaintId = String(complaint._id || complaint.id || "");
  const participantIds = await collectComplaintParticipantIds(complaint);
  const filteredIds = actorId
    ? participantIds.filter((id) => id !== String(actorId))
    : participantIds;

  broadcast(
    collectTargetSockets({ complaintId, userIds: filteredIds }),
    "complaint-updated",
    {
      complaintId,
      ticketId: complaint.ticketId,
      status: complaint.status,
      department: complaint.department,
      updatedAt: complaint.updatedAt || new Date(),
      event,
      ...extra,
    },
  );
}

function emitComplaintMessage({ complaintId, message, userIds = [] } = {}) {
  if (!complaintId || !message) return;
  broadcast(
    collectTargetSockets({ complaintId, userIds }),
    "complaint-message",
    {
      complaintId: String(complaintId),
      message,
    },
  );
}

function emitNotification(userId, payload = {}) {
  if (!userId) return;
  broadcast(
    collectTargetSockets({ userIds: [userId] }),
    "notification",
    payload,
  );
}

module.exports = {
  setupRealtime,
  emitComplaintUpdated,
  emitComplaintMessage,
  emitNotification,
};
