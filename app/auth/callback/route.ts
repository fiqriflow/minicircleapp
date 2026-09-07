import { createClient } from "@/lib/supabase/server";
import { getRegistrationLimit } from "@/lib/appSettings";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const intent = searchParams.get("intent"); // "signup" | "login" | null

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    const user = data?.user;

    if (user) {
      const isBrandNew = Date.now() - new Date(user.created_at).getTime() < 2 * 60 * 1000;

      // FIX: fitur "Hapus Akun" cuma soft-delete baris `profiles`, auth.users
      // TETAP ada. Jadi user yang login lagi pakai akun Google yg sama abis
      // dihapus, created_at-nya lama (isBrandNew = false) padahal profilnya
      // sudah gak ada. Sebelumnya intent "signup" langsung dianggap
      // "sudah terdaftar" cuma modal isBrandNew, gak ngecek profilnya masih
      // ada beneran atau enggak — makanya tombol "Daftar" salah nolak,
      // sedangkan tombol "Masuk" (gak lewat cek ini) malah lolos ke onboarding.
      // Query profiles cuma perlu jalan buat user yang bukan brand-new
      // (brand-new pasti sudah punya baris profiles dari trigger
      // on_auth_user_created, jadi gak perlu dicek).
      let hasProfile = true;
      if (!isBrandNew) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        hasProfile = !!existingProfile;
      }

      // Klik "Daftar dengan Google" tapi akun ini beneran masih aktif terdaftar
      // (bukan baru, dan baris profiles-nya masih ada) -> tolak ke login.
      // Kalau profilnya udah dihapus (meski auth.users lama), TETAP diizinkan
      // lanjut supaya user bisa daftar ulang / isi onboarding dari awal.
      if (intent === "signup" && !isBrandNew && hasProfile) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?notice=already-registered`);
      }

      // Cek kuota pendaftaran buat user baru ATAU bekas hapus akun
      // (keduanya butuh baris profiles baru / diisi ulang dari awal).
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
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
