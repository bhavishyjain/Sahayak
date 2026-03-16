const Notification = require("../models/Notification");
const User = require("../models/User");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const {
  sendExpoPushNotifications,
  isValidExpoPushToken,
} = require("../services/pushNotificationService");
const {
  buildNotificationPayload,
  persistNotification,
  shouldDeliverByPreference,
  shouldPersistNotification,
} = require("../services/notificationDomainService");
const {
  buildDetailPayload,
  buildListPayload,
} = require("../services/responseViewService");

exports.registerPushToken = asyncHandler(async (req, res) => {
  const { pushToken } = req.body;
  const normalizedToken = String(pushToken || "").trim();
  if (!normalizedToken) {
    throw new AppError("pushToken is required", 400);
  }
  if (!isValidExpoPushToken(normalizedToken)) {
    throw new AppError("Invalid Expo push token format", 400);
  }

  await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { pushTokens: normalizedToken } },
    { new: true },
  );

  return sendSuccess(res, {}, "Push token registered");
});

exports.getHistory = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ userId: req.user._id }),
  ]);

  const unreadCount = await Notification.countDocuments({
    userId: req.user._id,
    readAt: null,
  });

  return sendSuccess(
    res,
    buildListPayload({
      items: notifications,
      itemKey: "notifications",
      page,
      limit,
      total,
      legacy: {
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    }),
  );
});

exports.markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { readAt: new Date() },
    { new: true },
  );
  if (!notification) throw new AppError("Notification not found", 404);
  return sendSuccess(
    res,
    buildDetailPayload(notification, "notification", { notification }),
    "Marked as read",
  );
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, readAt: null },
    { readAt: new Date() },
  );
  return sendSuccess(res, {}, "All notifications marked as read");
});

exports.getPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "notificationPreferences",
  );
  return sendSuccess(res, {
    preferences: user.notificationPreferences ?? {},
  });
});

exports.updatePreferences = asyncHandler(async (req, res) => {
  const allowed = [
    "complaintsUpdates",
    "assignments",
    "escalations",
    "systemAlerts",
  ];
  const update = {};
  for (const key of allowed) {
    if (typeof req.body[key] === "boolean") {
      update[`notificationPreferences.${key}`] = req.body[key];
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: update },
    { new: true, select: "notificationPreferences" },
  );

  return sendSuccess(
    res,
    { preferences: user.notificationPreferences },
    "Preferences updated",
  );
});

exports.notifyUser = async (userId, payload, options = {}) => {
  try {
    const { saveHistory = true } = options;
    const user = await User.findById(userId).select(
      "pushTokens notificationPreferences",
    );
    if (!user) return;

    const normalizedPayload = buildNotificationPayload(payload);
    const type = normalizedPayload.data?.type;
    const prefs = user.notificationPreferences || {};
    if (!shouldDeliverByPreference(prefs, type)) return;

    if (shouldPersistNotification({ saveHistory, type })) {
      await persistNotification(userId, normalizedPayload);
    }

    if (!user.pushTokens?.length) return;
    await sendExpoPushNotifications(user.pushTokens, normalizedPayload);
  } catch (error) {
    console.error("notify user error", error);
  }
};
