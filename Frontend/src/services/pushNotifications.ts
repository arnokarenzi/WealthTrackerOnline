import { financeApi } from "./api";

export interface PushSupportInfo {
  supported: boolean;
  standalone: boolean;
}

const getStandaloneState = (): boolean => {
  if (typeof window === "undefined") return false;

  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(mediaStandalone || iosStandalone);
};

export const getPushSupportInfo = (): PushSupportInfo => ({
  supported:
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window,
  standalone: getStandaloneState(),
});

const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const bytes = Array.from(rawData, (char) => char.charCodeAt(0));
  return new Uint8Array(bytes) as Uint8Array<ArrayBuffer>;
};

export const registerPushServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  const swUrl = new URL("sw.js", baseUrl);

  return navigator.serviceWorker.register(swUrl.href, {
    scope: baseUrl.pathname.endsWith("/") ? baseUrl.pathname : `${baseUrl.pathname}/`,
  });
};

export const getExistingPushSubscription = async (): Promise<PushSubscription | null> => {
  const registration = await registerPushServiceWorker();
  return registration.pushManager.getSubscription();
};

export const enableDailyLetterNotifications = async (): Promise<void> => {
  const support = getPushSupportInfo();
  if (!support.supported) {
    throw new Error("This device/browser does not support web push notifications.");
  }

  if (!support.standalone) {
    throw new Error(
      "Open FinTrack from the Home Screen app icon before enabling notifications on iPhone.",
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked. Enable them in iPhone Settings > Notifications > FinTrack."
        : "Notification permission was not granted.",
    );
  }

  const registration = await registerPushServiceWorker();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const { publicKey } = await financeApi.getPushPublicKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await financeApi.savePushSubscription(subscription.toJSON());
};

export const disableDailyLetterNotifications = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) return;

  const registration = await registerPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await financeApi.removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
};

export const sendTestDailyLetterNotification = async (
  kind: "morning" | "midday" | "evening" | "target",
): Promise<{ title: string; body: string }> => {
  const subscription = await getExistingPushSubscription();
  if (!subscription) {
    throw new Error("Notifications are not enabled on this device yet.");
  }

  const result = await financeApi.sendTestPushNotification(
    subscription.toJSON(),
    kind,
  );
  return { title: result.title, body: result.body };
};
