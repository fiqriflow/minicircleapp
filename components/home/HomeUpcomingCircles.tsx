import { createClient } from "@/lib/supabase/server";
import { CIRCLE_COLUMNS } from "@/lib/circleColumns";
import { getDefaultCoverMap } from "@/lib/appSettings";
import { getJoinedCounts } from "@/lib/circleMembers";
import { chunk } from "@/lib/chunk";
import UpcomingCirclesSection from "@/components/home/UpcomingCirclesSection";

export default async function HomeUpcomingCircles() {
  const supabase = await createClient();

  const now = new Date();
  // circle yang baru mulai (masih masa check-in 24 jam) tetap tampil, bukan langsung hilang saat jam mulai
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
    // dipecah per 100 id: `.in()` dengan ratusan UUID bikin URL kepanjangan dan query gagal diam-diam
    const results = await Promise.all(
      chunk(joinedCircleIds, 100).map((ids) =>
        supabase
          .from("circles")
          .select(CIRCLE_COLUMNS)
          .eq("status", "active")
          .in("id", ids)
          .gte("event_date", from.toISOString())
          .lte("event_date", in30Days.toISOString())
      )
    );
    circles = results
      .flatMap((r) => (r.data ?? []) as any[])
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }

  const joinedCounts = await getJoinedCounts(supabase, (circles ?? []).map((c) => c.id));

  return (
    <UpcomingCirclesSection
      circles={circles ?? []}
      defaultCoverMap={defaultCoverMap}
      joinedCounts={joinedCounts}
      currentUserId={user?.id ?? null}
    />
  );
}
