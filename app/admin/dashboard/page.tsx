import { createClient } from "@/lib/supabase/server";
import { Users, UserCheck, CalendarPlus, CheckCircle2 } from "lucide-react";
import { UserGrowthChart, GenderPieChart, CircleStatusDonutChart, CircleByCategoryBarChart, TopActivityBarChart } from "@/components/admin/DashboardCharts";
import { getCircleDisplayStatus, STATUS_LABEL } from "@/lib/circleStatus";

const GENDER_LABEL: Record<string, string> = { male: "Pria", female: "Wanita" };

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

// Kumpulkan jumlah user baru per bulan dari created_at, lalu jadikan kumulatif
function buildGrowthData(profiles: any[]) {
  const perMonth: Record<string, { count: number; sortDate: number }> = {};
  profiles.forEach((p) => {
    if (!p.created_at) return;
    const d = new Date(p.created_at);
    const key = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    if (!perMonth[key]) perMonth[key] = { count: 0, sortDate: d.getTime() };
    perMonth[key].count += 1;
  });

  const sortedKeys = Object.keys(perMonth).sort((a, b) => perMonth[a].sortDate - perMonth[b].sortDate);

  let cumulative = 0;
  return sortedKeys.map((key) => {
    cumulative += perMonth[key].count;
    return { month: key, total: cumulative };
  });
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: circles }, { data: joinedMembers }] = await Promise.all([
    supabase.from("profiles").select("id, gender, categories, created_at"),
    supabase.from("circles").select("status, created_by, event_date, category"),
    supabase.from("circle_members").select("user_id").eq("status", "joined"),
  ]);

  const totalUser = profiles?.length ?? 0;

  const genderData = Object.entries(groupCount(profiles ?? [], "gender")).map(([k, v]) => ({
    name: GENDER_LABEL[k] || k,
    value: v,
  }));

  const growthData = buildGrowthData(profiles ?? []);

  const circleStatusCounts: Record<string, number> = { open: 0, ongoing: 0, completed: 0, cancelled: 0 };
  (circles ?? []).forEach((c) => {
    const s = getCircleDisplayStatus(c as any);
    circleStatusCounts[s] = (circleStatusCounts[s] ?? 0) + 1;
  });
  const circleStatusData = [
    { name: STATUS_LABEL.open.label, value: circleStatusCounts.open },
    { name: STATUS_LABEL.ongoing.label, value: circleStatusCounts.ongoing },
    { name: STATUS_LABEL.completed.label, value: circleStatusCounts.completed },
    { name: "Batal", value: circleStatusCounts.cancelled },
  ];

  const circleByCategoryData = Object.entries(groupCount(circles ?? [], "category"))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topActivityData = Object.entries(groupCount(profiles ?? [], "categories"))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

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

      {/* Pertumbuhan User (line chart) + Gender (pie chart) + Status Circle (donut) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UserGrowthChart data={growthData} />
        <GenderPieChart data={genderData} />
        <CircleStatusDonutChart data={circleStatusData} />
      </div>

      {/* Circle per Aktivitas (bar) + Top Aktivitas Disukai (horizontal bar) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CircleByCategoryBarChart data={circleByCategoryData} />
        <TopActivityBarChart data={topActivityData} />
      </div>
    </div>
  );
}
