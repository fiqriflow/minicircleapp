import { createClient } from "@/lib/supabase/server";

function groupCount(rows: any[], key: string) {
  const map: Record<string, number> = {};
  rows.forEach((r) => {
    const val = r[key] || "Tidak diketahui";
    if (Array.isArray(val)) {
      val.forEach((v) => (map[v] = (map[v] || 0) + 1));
    } else {
      map[val] = (map[val] || 0) + 1;
    }
  });
  return map;
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase.from("profiles").select("*");

  const total = profiles?.length ?? 0;
  const byCategory = groupCount(profiles ?? [], "categories");
  const byGender = groupCount(profiles ?? [], "gender");
  const byLocation = groupCount(profiles ?? [], "location");

  const Stat = ({ title, data }: { title: string; data: Record<string, number> }) => (
    <div className="bg-white rounded-2xl border p-4 space-y-2">
      <h3 className="font-semibold text-gray-700">{title}</h3>
      <ul className="text-sm text-gray-500 space-y-1">
        {Object.entries(data).map(([k, v]) => (
          <li key={k} className="flex justify-between">
            <span>{k}</span>
            <span className="font-medium text-gray-800">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="bg-primary text-white rounded-2xl p-6 w-fit">
        <p className="text-sm opacity-80">Total User</p>
        <p className="text-3xl font-bold">{total}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat title="Per Kategori" data={byCategory} />
        <Stat title="Per Gender" data={byGender} />
        <Stat title="Per Lokasi" data={byLocation} />
      </div>
    </div>
  );
}
