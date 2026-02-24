const User = require("../models/User");
const { sendExpoPushNotifications } = require("../services/pushNotificationService");

exports.registerPushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken || typeof pushToken !== "string") {
      return res.status(400).json({ message: "pushToken is required" });
    }

    await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { pushTokens: pushToken } },
      { new: true }
    );

    return res.status(200).json({ message: "Push token registered" });
  } catch (error) {
    console.error("register push token error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.sendTestNotification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("pushTokens");
    const result = await sendExpoPushNotifications(user?.pushTokens || [], {
      title: "Sahayak",
      body: "This is a test notification.",
      data: { type: "test" },
    });

    return res.status(200).json({ message: "Notification request sent", result });
  } catch (error) {
    console.error("send test notification error", error);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.notifyUser = async (userId, payload) => {
  try {
    const user = await User.findById(userId).select("pushTokens");
    if (!user?.pushTokens?.length) return;
    await sendExpoPushNotifications(user.pushTokens, payload);
  } catch (error) {
    console.error("notify user error", error);
  }
};
