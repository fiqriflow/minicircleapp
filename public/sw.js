// Service worker Mincle — network-first, cache seperlunya buat asset statis.
// Sengaja TIDAK cache halaman/data dinamis (Supabase) biar data selalu fresh.

const CACHE_NAME = "mincle-static-v1";
const STATIC_ASSETS = [
  "/logo-login.svg",
  "/logo-white.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Cuma tangani GET, dan skip request ke API/Supabase — biar selalu network fresh.
  if (request.method !== "GET") return;
  if (request.url.includes("/auth/") || request.url.includes("supabase.co")) return;

  // Untuk navigasi (buka halaman), coba network dulu; kalau offline & ada di cache, pakai cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((res) => res || caches.match("/")))
    );
    return;
  }

  // Untuk asset statis: cache-first biar cepat, tetap update cache di background.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // update cache di background, gak nunggu — user tetap dapet response cepat dari cache
        fetch(request)
          .then((res) => {
            if (res && res.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(request).then((res) => {
        if (res && res.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
        }
        return res;
      });
    })
  );
});

// ================= Push Notification =================
// Server (route /api/push/send) ngirim push dengan payload JSON:
// { title, body, url, icon }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Mincle", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Mincle";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Klik notif -> buka/fokus tab app, arahkan ke url terkait
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clientList.length > 0 && "focus" in clientList[0]) {
        clientList[0].navigate(targetUrl);
        return clientList[0].focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
