import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login" || path.startsWith("/auth") || path === "/pendaftaran-ditutup";
  const isAdminPage = path.startsWith("/admin");
  const isOnboardingPage = path === "/onboarding";
  const isSuspendedPage = path === "/akun-dinonaktifkan";
  const isPublicPolicyPage =
    path === "/profile/syarat-ketentuan" ||
    path === "/profile/kebijakan-privasi" ||
    path === "/profile/panduan-komunitas";

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && !isAuthPage) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin, onboarding_completed, is_banned, suspended_until")
      .eq("id", user.id)
      .single();

    const isSuspendedNow =
      profile?.is_banned || (profile?.suspended_until && new Date(profile.suspended_until) > new Date());

    if (isSuspendedNow && !isSuspendedPage) {
      return NextResponse.redirect(new URL("/akun-dinonaktifkan", request.url));
    }

    if (!isSuspendedNow && isSuspendedPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isSuspendedNow) {
      return response;
    }

    if (isPublicPolicyPage) {
      return response;
    }

    if (!profile?.onboarding_completed && !isOnboardingPage) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    if (profile?.onboarding_completed && isOnboardingPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isAdminPage && !profile?.is_super_admin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
