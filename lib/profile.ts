import type { SupabaseClient } from "@supabase/supabase-js";

// Kolom profil yang boleh dibaca user lain. birth_date, lat, lng, suspension_reason
// sengaja TIDAK ada (lihat migration 0028) -> jangan pakai select("*") ke tabel profiles.
export const PUBLIC_PROFILE_COLUMNS =
  "id, full_name, nickname, username, avatar_url, gender, instagram, categories, location, created_at";

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
