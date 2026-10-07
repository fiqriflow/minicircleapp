// Service worker Mincle — network-first, cache seperlunya buat asset statis.
// Sengaja TIDAK cache halaman/data dinamis (Supabase) biar data selalu fresh.

const CACHE_NAME = "mincle-static-v2";
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
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cuma cache asset statis same-origin. Halaman, RSC payload, /api, /auth
  // TIDAK PERNAH di-cache (data user bisa bocor ke akun lain di HP yang sama).
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
  if (url.searchParams.has("_rsc") || request.headers.get("RSC")) return;

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    STATIC_ASSETS.includes(url.pathname);
  if (!isStatic) return;

  // cache-first, update di background
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
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
  // Normalisasi ke path same-origin (cegah URL luar / format aneh)
  let target = new URL("/", self.location.origin);
  try {
    const u = new URL(event.notification.data?.url || "/", self.location.origin);
    if (u.origin === self.location.origin) target = u;
  } catch {}

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      // 1) tab yang sudah di halaman tujuan -> fokus saja
      for (const client of clientList) {
        const cu = new URL(client.url);
        if (cu.pathname === target.pathname && "focus" in client) return client.focus();
      }
      // 2) ada tab app lain -> arahkan ke tujuan, lalu fokus
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "navigate" in client) {
          try {
            const nav = await client.navigate(target.href);
            if (nav && "focus" in nav) return nav.focus();
            return client.focus();
          } catch {
            break;
          }
        }
      }
      // 3) tidak ada tab -> buka baru
      return self.clients.openWindow(target.href);
    })
  );
});
