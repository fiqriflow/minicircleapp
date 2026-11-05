import type { SupabaseClient } from "@supabase/supabase-js";

// Kolom profil yang boleh dibaca SEMUA user login. Kolom pribadi sengaja TIDAK ada
// (migration 0028 + 0067) -> jangan pakai select("*") ke tabel profiles.
//  - gender, instagram, location (kota): hanya sesama circle -> rpc("get_member_profile")
//  - profil SENDIRI (semua kolom): rpc("get_my_profile")
export const PUBLIC_PROFILE_COLUMNS =
  "id, full_name, nickname, username, avatar_url, categories, created_at, is_verified";

// Tambahan gender/instagram/location milik user lain (hanya terisi kalau satu circle dengan kita).
// Gagal / tidak berhak -> null; pemanggil cukup menampilkan data publik yang sudah ada.
export async function fetchMemberExtras(
  supabase: SupabaseClient,
  userId: string
): Promise<{ gender: string | null; instagram: string | null; location: string | null } | null> {
  try {
    const { data, error } = await supabase.rpc("get_member_profile", { p_user_id: userId }).maybeSingle();
    if (error || !data) return null;
    const d = data as any;
    return { gender: d.gender ?? null, instagram: d.instagram ?? null, location: d.location ?? null };
  } catch {
    return null;
  }
}

// Pesan error dari DB (migration 0045) kalau foto profil / Instagram belum diisi saat join / buat circle.
const PROFILE_INCOMPLETE_HINT = "Lengkapi foto profil & Instagram";
export function isProfileIncompleteError(message?: string | null) {
  return !!message && message.includes(PROFILE_INCOMPLETE_HINT);
}

// Simpan profil sendiri. Pakai UPDATE dulu, baru INSERT kalau barisnya belum ada.
// (upsert / ON CONFLICT butuh hak baca semua kolom, yang sudah dicabut di 0028.)
// Kolom sensitif (is_super_admin, energy, ban) di-reset server-side oleh trigger.
export async function saveProfile(supabase: SupabaseClient, profile: Record<string, any>) {
  const { id, ...rest } = profile;
  const { data, error } = await supabase.from("profiles").update(rest).eq("id", id).select("id");
  if (error) return { error };
  if (data && data.length > 0) return { error: null };
  const { error: insertError } = await supabase.from("profiles").insert({ id, ...rest });
  return { error: insertError };
}
