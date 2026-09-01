export async function getDefaultCircleCover(supabase: any): Promise<string | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "default_circle_cover").maybeSingle();
  return data?.value ?? null;
}

export async function getCirclePlusEnabled(supabase: any): Promise<boolean> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "circle_plus_enabled").maybeSingle();
  if (!data) return true; // default aktif kalau belum diset
  return data.value !== "false";
}
