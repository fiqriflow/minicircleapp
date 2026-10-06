export async function getJoinedCounts(supabase: any, circleIds: string[]): Promise<Record<string, number>> {
  if (!circleIds.length) return {};
  // Hitung di DB (RPC, migration 0038) -> tidak menarik semua baris member ke client/server.
  const { data } = await supabase.rpc("get_joined_counts", { p_circle_ids: circleIds });

  const counts: Record<string, number> = {};
  data?.forEach((row: any) => {
    counts[row.circle_id] = Number(row.joined_count) || 0;
  });
  return counts;
}
