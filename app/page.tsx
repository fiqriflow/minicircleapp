import Link from "next/link";
import { Bike, Footprints, PersonStanding, Grid3x3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDefaultCoverMap, getHomeBanner } from "@/lib/appSettings";
import { getJoinedCounts } from "@/lib/circleMembers";
import UpcomingCirclesSection from "@/components/UpcomingCirclesSection";
import BannerImage from "@/components/BannerImage";

const QUICK_ACCESS = [
  { label: "Circle Lari", category: "Running", icon: Footprints },
  { label: "Circle Gowes", category: "Gowes", icon: Bike },
  { label: "Circle Jalan Santai", category: "Jalan Santai", icon: PersonStanding },
  { label: "Lainnya", category: null, icon: Grid3x3 },
];

export default async function BerandaPage() {
  const supabase = await createClient();

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Ambil user + setting-setting yang tidak saling bergantung secara paralel
  const [
    { data: { user } },
    defaultCoverMap,
    homeBanner,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getDefaultCoverMap(supabase),
    getHomeBanner(supabase),
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
      .select("*")
      .eq("status", "active")
      .in("id", joinedCircleIds)
      .gte("event_date", now.toISOString())
      .lte("event_date", in30Days.toISOString())
      .order("event_date", { ascending: true });
    circles = data ?? [];
  }

  const joinedCounts = await getJoinedCounts(supabase, (circles ?? []).map((c) => c.id));

  return (
    <div className="px-4 py-6 space-y-8">
      {/* Banner / Hero — gambar diatur dari halaman admin appearance */}
      <section className="rounded-2xl overflow-hidden bg-gray-100 h-40">
        <BannerImage src={homeBanner} alt="Banner" />
      </section>

      {/* Quick Access */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Quick Access</h2>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACCESS.map(({ label, category, icon: Icon }) => (
            <Link
              key={label}
              href={category ? { pathname: "/explore", query: { category } } : "/explore"}
              className="flex flex-col items-center gap-2 bg-white border rounded-2xl p-3 hover:border-primary hover:bg-primary/5 text-center"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Icon size={20} />
              </div>
              <span className="text-xs font-medium leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Circle yang akan datang */}
      <UpcomingCirclesSection
        circles={circles ?? []}
        defaultCoverMap={defaultCoverMap}
        joinedCounts={joinedCounts}
      />
    </div>
  );
}
