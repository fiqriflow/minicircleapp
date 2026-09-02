import Link from "next/link";
import { Bike, Footprints, PersonStanding, Grid3x3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getDefaultCircleCover } from "@/lib/appSettings";
import UpcomingCirclesSection from "@/components/UpcomingCirclesSection";

const QUICK_ACCESS = [
  { label: "Circle Lari", category: "Running", icon: Footprints },
  { label: "Circle Gowes", category: "Gowes", icon: Bike },
  { label: "Circle Jalan Santai", category: "Jalan Santai", icon: PersonStanding },
  { label: "Lainnya", category: null, icon: Grid3x3 },
];

export default async function BerandaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: circles } = await supabase
    .from("circles")
    .select("*")
    .eq("status", "active")
    .eq("is_private", false)
    .gte("event_date", now.toISOString())
    .lte("event_date", in30Days.toISOString())
    .order("event_date", { ascending: true });

  const defaultCoverUrl = await getDefaultCircleCover(supabase);

  return (
    <div className="px-4 md:px-8 py-6 space-y-8">
      {/* Hero */}
      <section className="bg-primary text-white rounded-2xl p-8 space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold">
          Halo, {user?.user_metadata?.full_name?.split(" ")[0] ?? "Sobat"} 👋
        </h1>
        <p className="text-white/90">Yuk cari circle mabar terdekat & gabung sekarang!</p>
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
      <UpcomingCirclesSection circles={circles ?? []} defaultCoverUrl={defaultCoverUrl} />
    </div>
  );
}
