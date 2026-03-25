const User = require("../models/User");
const { emitNotification } = require("./realtimeService");
const {
  sendExpoPushNotifications,
  isValidExpoPushToken,
} = require("./pushNotificationService");
const {
  buildNotificationPayload,
  persistNotification,
  shouldDeliverByPreference,
  shouldPersistNotification,
} = require("./notificationDomainService");

async function deliverNotificationToUser(userId, payload, options = {}) {
  const {
    saveHistory = true,
    persist = undefined,
    emitRealtime = true,
    sendPush = true,
  } = options;

  const user = await User.findById(userId).select(
    "pushTokens notificationPreferences",
  );
  if (!user) {
    return { delivered: false, reason: "user-not-found" };
  }

  const normalizedPayload = buildNotificationPayload(payload);
  const type = normalizedPayload.data?.type;
  if (
    !shouldDeliverByPreference(user.notificationPreferences || {}, type)
  ) {
    return {
      delivered: false,
      reason: "preference-disabled",
      payload: normalizedPayload,
    };
  }

  const shouldPersist =
    persist === undefined
      ? shouldPersistNotification({ saveHistory, type })
      : Boolean(persist);

  let notification = null;
  if (shouldPersist) {
    notification = await persistNotification(userId, normalizedPayload);
  } else if (emitRealtime) {
    emitNotification(userId, {
      notification: {
        title: normalizedPayload.title,
        body: normalizedPayload.body,
        type,
        data: normalizedPayload.data || {},
      },
      unread: false,
      ephemeral: true,
    });
  }

  const validTokens = (user.pushTokens || []).filter(isValidExpoPushToken);
  const pushResult =
    sendPush && validTokens.length > 0
      ? await sendExpoPushNotifications(validTokens, normalizedPayload)
      : { sent: 0, tickets: [] };

  return {
    delivered: true,
    persisted: shouldPersist,
    emittedRealtime: emitRealtime,
    pushed: Boolean(sendPush && validTokens.length > 0),
    notification,
    payload: normalizedPayload,
    pushResult,
  };
}

async function deliverNotificationBatch(userIds = [], payload, options = {}) {
  const uniqueUserIds = [
    ...new Set(userIds.map((value) => String(value || "").trim()).filter(Boolean)),
  ];
  return Promise.all(
    uniqueUserIds.map((recipientId) =>
      deliverNotificationToUser(recipientId, payload, options),
    ),
  );
}

module.exports = {
  deliverNotificationToUser,
  deliverNotificationBatch,
};
