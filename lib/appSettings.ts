export async function getDefaultCircleCover(supabase: any): Promise<string | null> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "default_circle_cover").maybeSingle();
  return data?.value ?? null;
}
