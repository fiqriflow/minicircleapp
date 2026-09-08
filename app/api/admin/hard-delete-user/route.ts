import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
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

  const { data: caller } = await supabase
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
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
