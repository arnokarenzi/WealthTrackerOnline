/* FinTrack service worker: supports both legacy and declarative Web Push. */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};

      try {
        if (event.data) {
          const parsed = event.data.json();
          if (parsed && typeof parsed === "object") data = parsed;
        }
      } catch (_error) {
        data = {
          title: "FinTrack",
          body: event.data?.text?.() || "You have a new FinTrack notification.",
        };
      }

      const declared =
        data.notification && typeof data.notification === "object"
          ? data.notification
          : {};

      const title = data.title || declared.title || "FinTrack";
      const body =
        data.body || declared.body || "You have a new FinTrack notification.";
      const targetUrl =
        data.url || declared.navigate || data.navigate || self.registration.scope;
      const tag = data.type || declared.tag || data.tag || "fintrack-notification";

      const options = {
        body,
        tag,
        renotify: Boolean(data.renotify ?? declared.renotify ?? false),
        data: {
          ...(declared.data && typeof declared.data === "object"
            ? declared.data
            : {}),
          ...(data.data && typeof data.data === "object" ? data.data : {}),
          url: targetUrl,
        },
      };

      const icon = data.icon || declared.icon;
      const badge = data.badge || declared.badge;
      const image = data.image || declared.image;
      if (icon) options.icon = icon;
      if (badge) options.badge = badge;
      if (image) options.image = image;

      try {
        await self.registration.showNotification(title, options);
      } catch (error) {
        // Retry with basic options if an optional field was rejected on a device.
        console.error("FinTrack showNotification failed; retrying basic notification:", error);
        await self.registration.showNotification(title || "FinTrack", { body });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      let targetUrl;
      try {
        targetUrl = new URL(
          event.notification.data?.url || self.registration.scope,
          self.registration.scope,
        ).href;
      } catch (_error) {
        targetUrl = self.registration.scope;
      }

      const targetOrigin = new URL(targetUrl).origin;
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clients) {
        try {
          if (new URL(client.url).origin === targetOrigin) {
            if ("navigate" in client) await client.navigate(targetUrl);
            return await client.focus();
          }
        } catch (_error) {
          // Try the next open client, then open a new one below.
        }
      }

      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })(),
  );
});
