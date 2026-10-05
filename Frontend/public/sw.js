self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (_error) {
    data = {
      title: "FinTrack",
      body: event.data?.text?.() || "You have a new FinTrack notification.",
    };
  }

  // Also tolerate the declarative Web Push envelope used by newer WebKit.
  const declarativeNotification = data.notification || {};
  const title = data.title || declarativeNotification.title || "FinTrack";
  const body =
    data.body ||
    declarativeNotification.body ||
    "You have a new FinTrack notification.";

  const options = {
    body,
    tag: data.type || declarativeNotification.tag || "fintrack-notification",
    renotify: false,
    data: {
      url:
        data.url ||
        declarativeNotification.navigate ||
        self.registration.scope,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification.data?.url || self.registration.scope,
    self.registration.scope,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            try {
              if (new URL(client.url).origin === new URL(targetUrl).origin) {
                client.navigate(targetUrl);
                return client.focus();
              }
            } catch (_error) {
              // Ignore URLs that cannot be parsed and keep checking other clients.
            }
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
  );
});
