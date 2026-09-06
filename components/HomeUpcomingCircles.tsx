import { createClient } from "@/lib/supabase/server";
import { getDefaultCoverMap } from "@/lib/appSettings";
import { getJoinedCounts } from "@/lib/circleMembers";
import UpcomingCirclesSection from "@/components/UpcomingCirclesSection";

export default async function HomeUpcomingCircles() {
  const supabase = await createClient();

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    { data: { user } },
    defaultCoverMap,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getDefaultCoverMap(supabase),
  ]);

  let joinedCircleIds: string[] = [];
  if (user?.id) {
    const { data: myMemberships } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", user.id)
      .eq("status", "joined");
    joinedCircleIds = (myMemberships ?? []).map((m) => m.circle_id);
  }

  let circles: any[] = [];
  if (joinedCircleIds.length) {
    const { data } = await supabase
      .from("circles")
      .select("*, host:profiles!circles_created_by_fkey(nickname, full_name)")
      .eq("status", "active")
      .in("id", joinedCircleIds)
      .gte("event_date", now.toISOString())
      .lte("event_date", in30Days.toISOString())
      .order("event_date", { ascending: true });
    circles = data ?? [];
  }

  const joinedCounts = await getJoinedCounts(supabase, (circles ?? []).map((c) => c.id));

  return (
    <UpcomingCirclesSection
      circles={circles ?? []}
      defaultCoverMap={defaultCoverMap}
      joinedCounts={joinedCounts}
    />
  );
}
