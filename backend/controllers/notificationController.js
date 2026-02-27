const User = require("../models/User");
const AppError = require("../core/AppError");
const asyncHandler = require("../core/asyncHandler");
const { sendSuccess } = require("../core/response");
const { sendExpoPushNotifications } = require("../services/pushNotificationService");

exports.registerPushToken = asyncHandler(async (req, res) => {
  const { pushToken } = req.body;
  if (!pushToken || typeof pushToken !== "string") {
    throw new AppError("pushToken is required", 400);
  }

  await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { pushTokens: pushToken } },
    { new: true },
  );

  return sendSuccess(res, {}, "Push token registered");
});

exports.sendTestNotification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("pushTokens");
  const result = await sendExpoPushNotifications(user?.pushTokens || [], {
    title: "Sahayak",
    body: "This is a test notification.",
    data: { type: "test" },
  });

  return sendSuccess(res, { result }, "Notification request sent");
});

exports.notifyUser = async (userId, payload) => {
  try {
    const user = await User.findById(userId).select("pushTokens");
    if (!user?.pushTokens?.length) return;
    await sendExpoPushNotifications(user.pushTokens, payload);
  } catch (error) {
    console.error("notify user error", error);
  }
};
