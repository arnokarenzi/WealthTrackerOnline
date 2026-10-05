import {
  getVapidPublicKey,
  savePushSubscription,
  removePushSubscription,
  sendTestNotificationToSubscription,
} from "../services/pushService.js";

export const getPublicKey = async (req, res) => {
  try {
    res.json({ publicKey: getVapidPublicKey() });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
};

export const subscribe = async (req, res) => {
  try {
    await savePushSubscription(req.body, req.get("user-agent") || "");
    res.status(201).json({ message: "Push subscription saved." });
  } catch (err) {
    console.error("Push subscription save error:", err);
    res.status(400).json({ error: err.message });
  }
};

export const unsubscribe = async (req, res) => {
  try {
    await removePushSubscription(req.body?.endpoint);
    res.json({ message: "Push subscription removed." });
  } catch (err) {
    console.error("Push subscription removal error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Device-specific test endpoint. It sends only to the subscription supplied
// by the device that pressed the button and does not touch any app data.
export const testNotification = async (req, res) => {
  try {
    const { subscription, kind = "target" } = req.body || {};
    const result = await sendTestNotificationToSubscription({
      subscription,
      kind,
    });
    res.json(result);
  } catch (err) {
    console.error("Push test notification error:", err);
    res.status(400).json({ error: err.message });
  }
};
