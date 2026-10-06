import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Defense-in-depth anti-CSRF: request lintas-origin ditolak.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return NextResponse.json({ error: "Origin tidak valid" }, { status: 403 });
  }

  const { userId } = await request.json().catch(() => ({}));
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId wajib diisi" }, { status: 400 });
  }

  // 1) Pastikan yang manggil ini beneran login DAN super admin.
  //    Jangan pernah percaya "is_super_admin" dari body/client.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  // Kolom is_super_admin tidak bisa dibaca client (0036) -> cek pakai service role.
  const { data: caller } = await createAdminClient()
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!caller?.is_super_admin) {
    return NextResponse.json({ error: "Bukan super admin" }, { status: 403 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: "Tidak bisa hapus akun sendiri" }, { status: 400 });
  }

  // 2) Hapus permanen dari auth.users pakai service role key.
  //    Ini otomatis ikut menghapus baris profiles (FK: profiles.id
  //    references auth.users(id) on delete cascade), tanpa perlu hapus
  //    profiles secara manual.
  const adminClient = createAdminClient();

  // Jangan izinkan hapus sesama super admin lewat endpoint ini.
  const { data: target } = await adminClient
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  if (target?.is_super_admin) {
    return NextResponse.json({ error: "Tidak bisa hapus super admin" }, { status: 403 });
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
