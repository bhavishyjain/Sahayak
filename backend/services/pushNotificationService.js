function isValidExpoPushToken(token) {
  const expoTokenPattern = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
  return (
    typeof token === "string" &&
    expoTokenPattern.test(token.trim())
  );
}

async function sendExpoPushNotifications(tokens, payload) {
  const validTokens = (tokens || []).filter((token) =>
    isValidExpoPushToken(token),
  );

  if (!validTokens.length) return { sent: 0, tickets: [] };

  const messages = validTokens.map((to) => ({
    to,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    priority: "high",
  }));

  if (typeof fetch !== "function") {
    return { sent: 0, tickets: [], error: "fetch unavailable on runtime" };
  }

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(messages),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { sent: 0, tickets: [], error: result?.errors?.[0]?.message || "Push send failed" };
  }

  return {
    sent: validTokens.length,
    tickets: result.data || [],
  };
}

module.exports = {
  sendExpoPushNotifications,
  isValidExpoPushToken,
};
