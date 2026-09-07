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
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
