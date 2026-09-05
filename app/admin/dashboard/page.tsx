import { createClient } from "@/lib/supabase/server";
import { Users, UserCheck, CalendarPlus, CheckCircle2 } from "lucide-react";

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
  const { data: circles } = await supabase.from("circles").select("status, created_by");
  const { data: joinedMembers } = await supabase.from("circle_members").select("user_id").eq("status", "joined");

  const totalUser = profiles?.length ?? 0;
  const byCategory = groupCount(profiles ?? [], "categories");
  const byGender = groupCount(profiles ?? [], "gender");
  const byLocation = groupCount(profiles ?? [], "location");

  // User Aktif = pernah join circle ATAU pernah bikin circle (unik per user)
  const activeUserIds = new Set<string>([
    ...(joinedMembers ?? []).map((m) => m.user_id),
    ...(circles ?? []).map((c) => c.created_by).filter(Boolean),
  ]);
  const userAktif = activeUserIds.size;

  const totalCircleDibuat = circles?.length ?? 0;
  const totalCircleSelesai = (circles ?? []).filter((c) => c.status === "completed").length;

  const KPI_CARDS = [
    { label: "Total User", value: totalUser, icon: Users, className: "bg-primary/10 text-primary" },
    { label: "User Aktif", value: userAktif, icon: UserCheck, className: "bg-green-100 text-green-600" },
    { label: "Circle Dibuat", value: totalCircleDibuat, icon: CalendarPlus, className: "bg-blue-100 text-blue-600" },
    { label: "Circle Selesai", value: totalCircleSelesai, icon: CheckCircle2, className: "bg-gray-200 text-gray-700" },
  ];

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_CARDS.map(({ label, value, icon: Icon, className }) => (
          <div key={label} className="bg-white rounded-2xl border p-4 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${className}`}>
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-400 truncate">{label}</p>
              <p className="text-2xl font-bold text-gray-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat title="Per Aktivitas" data={byCategory} />
        <Stat title="Per Gender" data={byGender} />
        <Stat title="Per Lokasi" data={byLocation} />
      </div>
    </div>
  );
}
