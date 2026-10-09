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

const urlBase64ToArrayBuffer = (base64String: string): ArrayBuffer => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const bytes = Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
};

export const registerPushServiceWorker = async (): Promise<ServiceWorkerRegistration> => {
  if (!getPushSupportInfo().supported) {
    throw new Error("This device/browser does not support Web Push notifications.");
  }

  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  const swUrl = new URL("sw.js", baseUrl);
  const scope = baseUrl.pathname.endsWith("/") ? baseUrl.pathname : `${baseUrl.pathname}/`;

  const registration = await navigator.serviceWorker.register(swUrl.href, {
    scope,
    updateViaCache: "none",
  });

  // Ask the browser to check for the new service worker code after deployment.
  // A failed update check should not discard a working registration.
  try {
    await registration.update();
  } catch (error) {
    console.warn("FinTrack service-worker update check failed:", error);
  }

  return registration;
};

export const getExistingPushSubscription = async (): Promise<PushSubscription | null> => {
  const registration = await registerPushServiceWorker();
  return registration.pushManager.getSubscription();
};

export const enableDailyLetterNotifications = async (): Promise<void> => {
  const support = getPushSupportInfo();
  if (!support.supported) {
    throw new Error("This device/browser does not support Web Push notifications.");
  }

  if (!support.standalone) {
    throw new Error(
      "Open FinTrack from the Home Screen app icon before enabling notifications on iPhone.",
    );
  }

  // This must be invoked directly from a user tap/click.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked. Enable them in iPhone Settings > Notifications > FinTrack."
        : "Notification permission was not granted.",
    );
  }

  const registration = await registerPushServiceWorker();
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const { publicKey } = await financeApi.getPushPublicKey();
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKey),
    });
  }

  // Always upsert the current device subscription on the backend, including
  // when the browser already had a subscription from before the deployment.
  await financeApi.savePushSubscription(subscription.toJSON());
};

export const disableDailyLetterNotifications = async (): Promise<void> => {
  if (!("serviceWorker" in navigator)) return;

  const registration = await registerPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  // Delete the matching server record before unsubscribing this device.
  await financeApi.removePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
};
