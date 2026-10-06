import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// CSP dibuat per-request dengan nonce (tanpa 'unsafe-inline' di script-src).
// Set CSP_REPORT_ONLY=1 di Vercel untuk tes tanpa memblokir apa pun.
const CSP_HEADER =
  process.env.CSP_REPORT_ONLY === "1"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

// Batasi ke host project Supabase sendiri (bukan semua *.supabase.co).
// Fallback ke wildcard kalau env tidak terbaca.
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();
const SB_HTTP = SUPABASE_HOST ? `https://${SUPABASE_HOST}` : "https://*.supabase.co";
const SB_WS = SUPABASE_HOST ? `wss://${SUPABASE_HOST}` : "wss://*.supabase.co";

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${SB_HTTP} https://lh3.googleusercontent.com https://ui-avatars.com https://www.google.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${SB_HTTP} ${SB_WS}`,
    "frame-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Endpoint push notification dipanggil server-ke-server (Supabase Database
  // Webhook) atau dari client tapi divalidasi manual di dalam route-nya sendiri
  // (subscribe/unsubscribe pakai session, send pakai secret header) -> gak
  // punya cookie login kayak request browser biasa, jadi jangan di-redirect.
  if (path.startsWith("/api/push/") || path === "/api/keepalive") {
    return NextResponse.next();
  }

  // Nonce diteruskan lewat header request -> Next.js otomatis memasangnya di semua <script>.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_HEADER, csp);

  const nextWithCsp = () => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set(CSP_HEADER, csp);
    return res;
  };

  let response = nextWithCsp();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // header request adalah salinan -> sinkronkan cookie yang baru di-refresh
          requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
          response = nextWithCsp();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // FIX: session logout sendiri secara acak (terutama admin yang sering
  // pindah halaman) -> penyebabnya redirect di bawah ini bikin
  // NextResponse.redirect() BARU, yang gak bawa cookie sesi yang baru
  // di-refresh Supabase (tersimpan di `response` lewat setAll di atas).
  // Kalau pas momen itu access token lagi di-refresh (rotate refresh
  // token), cookie baru ke-buang -> request berikutnya browser masih
  // kirim refresh token LAMA yang udah gak valid -> ke-logout paksa.
  // Solusinya: setiap redirect, salin dulu cookie dari `response` ke
  // redirect response-nya.
  const redirect = (path: string) => {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  };

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthPage = path === "/login" || path.startsWith("/auth") || path === "/pendaftaran-ditutup";
  const isAdminPage = path.startsWith("/admin");
  const isOnboardingPage = path === "/onboarding";
  const isSuspendedPage = path === "/akun-dinonaktifkan";
  const isMaintenancePage = path === "/maintenance";
  const isPublicPolicyPage =
    path === "/profile/syarat-ketentuan" ||
    path === "/profile/kebijakan-privasi" ||
    path === "/profile/panduan-komunitas";

  let profile: {
    is_super_admin?: boolean;
    onboarding_completed?: boolean;
    is_banned?: boolean;
    suspended_until?: string | null;
  } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("is_super_admin, onboarding_completed, is_banned, suspended_until")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  // ================= Maintenance mode =================
  // Kalau nyala, semua orang (kecuali super admin) diarahkan ke halaman
  // maintenance. Halaman login/auth tetap bisa diakses biar admin bisa login.
  const { data: maintenanceSetting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .maybeSingle();
  const maintenanceOn = maintenanceSetting?.value === "true";

  if (maintenanceOn && !profile?.is_super_admin && !isMaintenancePage && !isAuthPage) {
    return redirect("/maintenance");
  }

  if (!maintenanceOn && isMaintenancePage) {
    return redirect("/");
  }

  // Begitu user (yang emang seharusnya diblokir) udah nyampe di /maintenance,
  // STOP di sini -> jangan lanjut ke cek onboarding/suspended/dst di bawah,
  // soalnya itu bisa nge-redirect balik ke halaman lain yang ketimpa aturan
  // maintenance lagi -> bolak-balik selamanya (infinite redirect loop).
  if (isMaintenancePage) {
    return response;
  }

  if (!user && !isAuthPage) {
    return redirect("/login");
  }

  if (user && !isAuthPage) {
    const isSuspendedNow =
      profile?.is_banned || (profile?.suspended_until && new Date(profile.suspended_until) > new Date());

    if (isSuspendedNow && !isSuspendedPage) {
      return redirect("/akun-dinonaktifkan");
    }

    if (!isSuspendedNow && isSuspendedPage) {
      return redirect("/");
    }

    if (isSuspendedNow) {
      return response;
    }

    if (isPublicPolicyPage) {
      return response;
    }

    if (!profile?.onboarding_completed && !isOnboardingPage) {
      return redirect("/onboarding");
    }

    if (profile?.onboarding_completed && isOnboardingPage) {
      return redirect("/");
    }

    if (isAdminPage && !profile?.is_super_admin) {
      return redirect("/");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
