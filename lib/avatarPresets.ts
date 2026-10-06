import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_PRESET_BUCKET = "avatar-presets";

export type AvatarPreset = {
  id: string;
  name: string;
  image_url: string;
  storage_path: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

/** Ambil preset. activeOnly=true untuk user (onboarding), false untuk admin. */
export async function fetchAvatarPresets(supabase: SupabaseClient, activeOnly = true) {
  let q = supabase
    .from("avatar_presets")
    .select("id, name, image_url, storage_path, sort_order, is_active, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  return { data: (data ?? []) as AvatarPreset[], error };
}
