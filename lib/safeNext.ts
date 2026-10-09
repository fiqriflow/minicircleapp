// Tujuan setelah login (?next=). Hanya path internal; tolak URL luar (open redirect) & halaman auth/sistem.
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw === "/") return null;
  if (/^\/(login|auth|onboarding|maintenance|akun-dinonaktifkan|pendaftaran-ditutup|api)(\/|\?|$)/.test(raw)) return null;
  return raw.slice(0, 300);
}
