// Allowlist host push service resmi. Mencegah SSRF: server (/api/push/send)
// hanya boleh mengirim ke push service browser, bukan URL sembarang.
const EXACT_HOSTS = new Set([
  "fcm.googleapis.com", // Chrome, Edge, Brave, Samsung, dll
  "android.googleapis.com",
  "updates.push.services.mozilla.com", // Firefox
  "web.push.apple.com", // Safari / iOS PWA
]);

const SUFFIX_HOSTS = [
  ".push.services.mozilla.com",
  ".notify.windows.com", // Edge lama / WNS
  ".push.apple.com",
];

export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;

  const host = url.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || SUFFIX_HOSTS.some((s) => host.endsWith(s));
}
