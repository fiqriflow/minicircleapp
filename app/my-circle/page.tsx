import { createClient } from "@/lib/supabase/server";
import CircleCard from "@/components/CircleCard";

export default async function MyCirclePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("circle_members")
    .select("circle:circles(*)")
    .eq("user_id", user?.id);

  const all = (memberships?.map((m: any) => m.circle).filter(Boolean) ?? []);
  const active = all.filter((c: any) => c.status === "active");
  const completed = all.filter((c: any) => c.status === "completed");

  return (
    <div className="px-4 md:px-8 py-6 space-y-8">
      <h1 className="text-xl font-bold">My Circle</h1>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-700">Sedang Diikuti</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.length ? (
            active.map((c: any) => <CircleCard key={c.id} circle={c} />)
          ) : (
            <p className="text-gray-400 text-sm">Belum join circle apapun.</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-700">Selesai</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {completed.length ? (
            completed.map((c: any) => <CircleCard key={c.id} circle={c} />)
          ) : (
            <p className="text-gray-400 text-sm">Belum ada riwayat circle.</p>
          )}
        </div>
      </section>
    </div>
  );
}
