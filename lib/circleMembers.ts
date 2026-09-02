export async function getJoinedCounts(supabase: any, circleIds: string[]): Promise<Record<string, number>> {
  if (!circleIds.length) return {};
  const { data } = await supabase
    .from("circle_members")
    .select("circle_id")
    .in("circle_id", circleIds)
    .eq("status", "joined");

  const counts: Record<string, number> = {};
  data?.forEach((row: any) => {
    counts[row.circle_id] = (counts[row.circle_id] || 0) + 1;
  });
  return counts;
}
