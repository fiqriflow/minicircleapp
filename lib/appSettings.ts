export async function getCirclePlusEnabled(supabase: any): Promise<boolean> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "circle_plus_enabled").maybeSingle();
  if (!data) return true; // default aktif kalau belum diset
  return data.value !== "false";
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

export function resolveCircleCover(
  map: Record<string, string>,
  category: string | undefined,
  circleCoverUrl?: string | null
): string | null {
  if (circleCoverUrl) return circleCoverUrl;
  if (category && map[`default_circle_cover:${category}`]) return map[`default_circle_cover:${category}`];
  return map["default_circle_cover"] || null;
}
