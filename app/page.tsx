import { createClient } from "@/lib/supabase/server";
import CircleCard from "@/components/CircleCard";

export default async function BerandaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: circles } = await supabase
    .from("circles")
    .select("*")
    .eq("status", "active")
    .order("event_date", { ascending: true })
    .limit(6);

  return (
    <div className="px-4 md:px-8 py-6 space-y-8">
      {/* Hero */}
      <section className="bg-primary text-white rounded-2xl p-8 space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold">
          Halo, {user?.user_metadata?.full_name?.split(" ")[0] ?? "Sobat"} 👋
        </h1>
        <p className="text-white/90">Yuk cari circle mabar terdekat & gabung sekarang!</p>
      </section>

      {/* Circle terdekat */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Circle Terdekat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {circles?.length ? (
            circles.map((c) => <CircleCard key={c.id} circle={c} />)
          ) : (
            <p className="text-gray-400 text-sm">Belum ada circle aktif di sekitarmu.</p>
          )}
        </div>
      </section>
    </div>
  );
}
