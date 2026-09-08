// Helper push notification, dipanggil dari client (browser).

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// Minta izin notif ke user, subscribe ke push manager, simpan subscription ke server.
// Aman dipanggil berkali-kali (kalau udah subscribe, langsung return).
export async function subscribeToPush() {
  if (!(await isPushSupported())) return { ok: false, reason: "not_supported" as const };

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return { ok: false, reason: "no_vapid_key" as const };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "permission_denied" as const };

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  if (!res.ok) return { ok: false, reason: "save_failed" as const };
  return { ok: true as const };
}

// Dipanggil saat user logout / matiin notif dari HP ini.
export async function unsubscribeFromPush() {
  if (!(await isPushSupported())) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => {});

  await subscription.unsubscribe().catch(() => {});
}
