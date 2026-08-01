// Bumped from v1: that cache served navigations cache-first, which pinned every
// returning visitor's UI to the first build they ever loaded. Renaming it makes
// activate() drop the poisoned HTML entry instead of keeping it forever.
const STATIC_CACHE = "rail-nation-static-v2";
const SEARCH_CACHE = "rail-nation-search-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => ![STATIC_CACHE, SEARCH_CACHE].includes(key)).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api/transit/search") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(SEARCH_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || new Response(
          JSON.stringify({ message: "This route has not been cached for offline use yet." }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        )),
    );
    return;
  }

  // Vite's build output is content-hashed, so a hit under /assets/ can never be
  // stale — the filename changes whenever the contents do. Cache-first is safe
  // here and nowhere else.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })),
    );
    return;
  }

  // Everything else is served network-first, falling back to cache offline.
  //
  // The HTML shell names the current hashed bundle, so a cached copy pins the
  // whole app to an old build: the API keeps returning new fields that the
  // frozen UI has no code to render. That is how a merged fix could ship and
  // still show users the old screen. The same applies to the un-hashed public
  // files (manifest, icons) — none of them change name when they change.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            // Key the offline fallback on "/" so any route restores the shell.
            void caches.open(STATIC_CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match("/")) || Response.error()),
    );
    return;
  }

  if (/\.(?:js|css|svg|png|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || Response.error()),
    );
  }
});

// Schedule-change notifications for saved routes — payload is sent by
// scripts/check-push-notifications.ts as JSON: { title, body }.
self.addEventListener("push", (event) => {
  let payload = { title: "TransitRail", body: "" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-icon.svg",
      badge: "/pwa-icon.svg",
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
