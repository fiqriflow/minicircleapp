import { createClient } from "@/lib/supabase/server";
import { getRegistrationLimit } from "@/lib/appSettings";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const intent = searchParams.get("intent"); // "signup" | "login" | null

  // Google/Supabase bisa balikin error langsung di query (misal user cancel
  // consent, atau provider error) tanpa "code" sama sekali. Sebelumnya ini
  // gak ditangkap -> langsung redirect ke "/" -> proxy nemu belum ada
  // session -> tendang balik ke /login -> KELIHATAN LOOP padahal ini gagal
  // senyap. Sekarang ditangkap & dikasih notice yang jelas.
  const oauthError = searchParams.get("error_description") || searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/login?notice=auth-failed&reason=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?notice=auth-failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // FIX UTAMA: kalau tukar code->session gagal (mis. cookie code_verifier
  // gak kesimpen/kebaca di browser HP tertentu, koneksi putus, dll),
  // sebelumnya kode ini diam-diam lanjut ke redirect "/" seolah sukses.
  // Itu yang bikin looping tak berujung ke /login. Sekarang begitu gagal,
  // langsung kasih tau user & jangan pura-pura lanjut.
  if (error || !data?.user) {
    return NextResponse.redirect(
      `${origin}/login?notice=auth-failed&reason=${encodeURIComponent(error?.message || "no-session")}`
    );
  }

  const user = data.user;
  const isBrandNew = Date.now() - new Date(user.created_at).getTime() < 2 * 60 * 1000;

  let hasProfile = true;
  if (!isBrandNew) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    hasProfile = !!existingProfile;
  }

  if (intent === "signup" && !isBrandNew && hasProfile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?notice=already-registered`);
  }

  if (isBrandNew || !hasProfile) {
    const { enabled, limit } = await getRegistrationLimit(supabase);
    if (enabled && limit > 0) {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      if ((count ?? 0) > limit) {
        await supabase.from("profiles").delete().eq("id", user.id);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/pendaftaran-ditutup`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
