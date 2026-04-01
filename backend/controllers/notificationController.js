const Notification = require("../models/Notification");
const AdminNotificationBroadcast = require("../models/AdminNotificationBroadcast");
const User = require("../models/User");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const {
  isValidExpoPushToken,
} = require("../services/pushNotificationService");
const {
  deliverNotificationToUser,
  deliverNotificationBatch,
} = require("../services/notificationDeliveryService");
const {
  buildDetailPayload,
  buildListPayload,
  buildSummaryPayload,
} = require("../services/responseViewService");
const { NOTIFICATION_TYPES, ROLES } = require("../domain/constants");
const {
  getAllowedNotificationPreferenceKeys,
  buildRoleScopedNotificationPreferences,
} = require("../services/notificationDomainService");

function buildBroadcastAudienceLabel(roles = []) {
  const normalizedRoles = [...new Set(
    roles
      .map((role) => String(role || "").trim())
      .filter((role) => Object.values(ROLES).includes(role)),
  )];

  if (normalizedRoles.length === 0) {
    return "All active users";
  }

  const roleLabels = {
    [ROLES.USER]: "Citizens",
    [ROLES.WORKER]: "Workers",
    [ROLES.HEAD]: "Department heads",
    [ROLES.ADMIN]: "Admins",
  };

  return normalizedRoles.map((role) => roleLabels[role] || role).join(", ");
}

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
    "role notificationPreferences",
  );

  return sendSuccess(res, {
    role: user.role,
    allowedKeys: getAllowedNotificationPreferenceKeys(user.role),
    preferences: buildRoleScopedNotificationPreferences(
      user.notificationPreferences ?? {},
      user.role,
    ),
  });
});

exports.updatePreferences = asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.user._id).select("role");
  const allowed = getAllowedNotificationPreferenceKeys(currentUser?.role);
  const update = {};
  for (const key of allowed) {
    if (typeof req.body[key] === "boolean") {
      update[`notificationPreferences.${key}`] = req.body[key];
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: update },
    { new: true, select: "role notificationPreferences" },
  );

  return sendSuccess(
    res,
    {
      role: user.role,
      allowedKeys: getAllowedNotificationPreferenceKeys(user.role),
      preferences: buildRoleScopedNotificationPreferences(
        user.notificationPreferences ?? {},
        user.role,
      ),
    },
    "Preferences updated",
  );
});

exports.getAdminBroadcastHistory = asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));

  const broadcasts = await AdminNotificationBroadcast.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("createdBy", "fullName username email")
    .lean();

  return sendSuccess(
    res,
    buildListPayload({
      items: broadcasts,
      itemKey: "broadcasts",
      page: 1,
      limit,
      total: broadcasts.length,
    }),
  );
});

exports.createAdminBroadcast = asyncHandler(async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim();
  const requestedRoles = Array.isArray(req.body?.roles)
    ? [...new Set(
        req.body.roles
          .map((role) => String(role || "").trim())
          .filter((role) => Object.values(ROLES).includes(role)),
      )]
    : [];

  if (!title || !body) {
    throw new AppError("title and body are required", 400);
  }

  const userFilter = {
    isActive: true,
  };

  if (requestedRoles.length > 0) {
    userFilter.role = { $in: requestedRoles };
  }

  const recipients = await User.find(userFilter).select("_id");
  const recipientIds = recipients.map((user) => user._id);

  const deliveryResults = await deliverNotificationBatch(
    recipientIds,
    {
      title,
      body,
      data: {
        type: NOTIFICATION_TYPES.SYSTEM,
        route: null,
        source: "admin-broadcast",
      },
    },
    {
      saveHistory: true,
      emitRealtime: true,
      sendPush: true,
    },
  );

  const recipientCount = recipientIds.length;
  const deliveredCount = deliveryResults.filter((result) => result?.delivered).length;
  const skippedCount = Math.max(0, recipientCount - deliveredCount);
  const pushSentCount = deliveryResults.reduce(
    (sum, result) => sum + Number(result?.pushResult?.sent || 0),
    0,
  );

  const status =
    deliveredCount === 0
      ? "failed"
      : deliveredCount === recipientCount
        ? "sent"
        : "partial";

  const broadcast = await AdminNotificationBroadcast.create({
    createdBy: req.user._id,
    title,
    body,
    audienceLabel: buildBroadcastAudienceLabel(requestedRoles),
    recipientRoles: requestedRoles,
    recipientCount,
    deliveredCount,
    skippedCount,
    pushSentCount,
    status,
  });

  const populatedBroadcast = await AdminNotificationBroadcast.findById(
    broadcast._id,
  )
    .populate("createdBy", "fullName username email")
    .lean();

  return sendSuccess(
    res,
    buildSummaryPayload(
      {
        broadcast: populatedBroadcast,
        recipientCount,
        deliveredCount,
        skippedCount,
        pushSentCount,
        status,
      },
      "result",
      {
        broadcast: populatedBroadcast,
      },
    ),
    "Notification broadcast sent successfully",
    201,
  );
});

exports.notifyUser = async (userId, payload, options = {}) => {
  try {
    return await deliverNotificationToUser(userId, payload, options);
  } catch (error) {
    console.error("notify user error", error);
    return null;
  }
};
