export async function getCirclePlusEnabled(supabase: any): Promise<boolean> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "circle_plus_enabled").maybeSingle();
  if (!data) return true; // default aktif kalau belum diset
  return data.value !== "false";
}

// Limit pendaftar baru — { enabled, limit }
export async function getRegistrationLimit(supabase: any): Promise<{ enabled: boolean; limit: number }> {
  const { data } = await supabase
    .from("app_settings")
    .select("key,value")
    .in("key", ["registration_limit_enabled", "registration_limit_count"]);
  const map: Record<string, string> = {};
  data?.forEach((row: any) => (map[row.key] = row.value));
  return {
    enabled: map.registration_limit_enabled === "true",
    limit: Number(map.registration_limit_count) || 0,
  };
}

// Default cover per kategori. Key format: "default_circle_cover:<category>", fallback "default_circle_cover"
export async function getDefaultCoverMap(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("app_settings").select("key,value").like("key", "default_circle_cover%");
  const map: Record<string, string> = {};
  data?.forEach((row: any) => {
    if (row.value) map[row.key] = row.value;
  });
  return map;
}

// Banner/hero beranda — diatur dari halaman admin appearance
export async function getHomeBanner(supabase: any): Promise<string | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "home_banner").maybeSingle();
  return data?.value || null;
}

export function resolveCircleCover(
  map: Record<string, string>,
  category: string | undefined,
  circleCoverUrl?: string | null
): string | null {
  if (circleCoverUrl) return circleCoverUrl;
  if (category && map[`default_circle_cover:${category}`]) return map[`default_circle_cover:${category}`];
  return map["default_circle_cover"] || null;
}
