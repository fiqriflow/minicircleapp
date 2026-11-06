import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_PRESET_BUCKET = "avatar-presets";

export type AvatarPreset = {
  id: string;
  name: string;
  image_url: string;
  storage_path: string;
  sort_order: number;
  is_active: boolean;
  gender: "male" | "female" | null; // null = belum dikategorikan (tampil ke semua)
  created_at: string;
};

/**
 * Ambil preset. activeOnly=true untuk user (onboarding), false untuk admin.
 * gender diisi -> hanya avatar gender itu + yang belum dikategorikan (null).
 */
export async function fetchAvatarPresets(
  supabase: SupabaseClient,
  activeOnly = true,
  gender?: string | null
) {
  let q = supabase
    .from("avatar_presets")
    .select("id, name, image_url, storage_path, sort_order, is_active, created_at, gender")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  if (gender === "male" || gender === "female") q = q.or(`gender.eq.${gender},gender.is.null`);
  const { data, error } = await q;
  return { data: (data ?? []) as AvatarPreset[], error };
}
