const User = require("../models/User");
const Notification = require("../models/Notification");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const {
  sendExpoPushNotifications,
  isValidExpoPushToken,
} = require("../services/pushNotificationService");

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

  return sendSuccess(res, {
    notifications,
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

exports.markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { readAt: new Date() },
    { new: true },
  );
  if (!notification) throw new AppError("Notification not found", 404);
  return sendSuccess(res, { notification }, "Marked as read");
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

    // Check preference if type is provided
    const type = payload?.data?.type;
    const prefs = user.notificationPreferences || {};
    if (type === "complaint-update" && prefs.complaintsUpdates === false)
      return;
    if (type === "assignment" && prefs.assignments === false) return;
    if (type === "escalation" && prefs.escalations === false) return;
    if (type === "system" && prefs.systemAlerts === false) return;

    // Chat messages are push-only and must never be persisted in notification history.
    const shouldPersist = saveHistory && type !== "chat-message";

    if (shouldPersist) {
      Notification.create({
        userId,
        title: payload.title || "Notification",
        body: payload.body || "",
        type: type || "other",
        data: payload.data || {},
      }).catch((err) => console.error("notifyUser: save error", err));
    }

    if (!user.pushTokens?.length) return;
    await sendExpoPushNotifications(user.pushTokens, payload);
  } catch (error) {
    console.error("notify user error", error);
  }
};
