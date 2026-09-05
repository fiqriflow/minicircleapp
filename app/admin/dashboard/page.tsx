import { createClient } from "@/lib/supabase/server";
import { Users, UserCheck, CalendarPlus, CheckCircle2 } from "lucide-react";
import {
  UserGrowthChart,
  GenderPieChart,
  CircleStatusDonutChart,
  CircleByCategoryBarChart,
  TopActivityBarChart,
  UserByLocationBarChart,
  EngagedUsersChart,
  ActivityByWeekdayChart,
} from "@/components/admin/DashboardCharts";
import { getCircleDisplayStatus, STATUS_LABEL } from "@/lib/circleStatus";

const GENDER_LABEL: Record<string, string> = { male: "Pria", female: "Wanita" };
const WEEKDAY_ORDER = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const WEEKDAY_CHART_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

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

// Hitung DAU/WAU/MAU untuk 14 hari terakhir dari kumpulan event (bikin circle, join circle, komen)
function buildEngagementData(events: { user_id: string; date: string }[]) {
  const byDate: Record<string, Set<string>> = {};
  events.forEach((e) => {
    if (!e.user_id || !e.date) return;
    const key = e.date.slice(0, 10);
    if (!byDate[key]) byDate[key] = new Set();
    byDate[key].add(e.user_id);
  });

  const today = new Date();
  const result = [];
  for (let i = 13; i >= 0; i--) {
    const dayDate = new Date(today);
    dayDate.setDate(dayDate.getDate() - i);
    const dayKey = dayDate.toISOString().slice(0, 10);

    const dau = byDate[dayKey]?.size ?? 0;

    const wauSet = new Set<string>();
    const mauSet = new Set<string>();
    for (let j = 0; j < 30; j++) {
      const d = new Date(dayDate);
      d.setDate(d.getDate() - j);
      const key = d.toISOString().slice(0, 10);
      if (j < 7) byDate[key]?.forEach((u) => wauSet.add(u));
      byDate[key]?.forEach((u) => mauSet.add(u));
    }

    result.push({
      day: dayDate.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      dau,
      wau: wauSet.size,
      mau: mauSet.size,
    });
  }
  return result;
}

// Total aktivitas (bikin circle, join, komen) dikelompokkan per hari-dalam-minggu
function buildActivityByWeekday(dates: string[]) {
  const counts: Record<string, number> = {};
  WEEKDAY_ORDER.forEach((d) => (counts[d] = 0));
  dates.forEach((date) => {
    if (!date) return;
    const dayName = WEEKDAY_ORDER[new Date(date).getDay()];
    counts[dayName] += 1;
  });
  return WEEKDAY_CHART_ORDER.map((name) => ({ name, value: counts[name] }));
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const [{ data: profiles }, { data: circles }, { data: members }, { data: comments }] = await Promise.all([
    supabase.from("profiles").select("id, gender, categories, location, created_at"),
    supabase.from("circles").select("status, created_by, event_date, category, created_at"),
    supabase.from("circle_members").select("user_id, status, joined_at"),
    supabase.from("circle_comments").select("user_id, created_at"),
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

  const userByLocationData = Object.entries(groupCount(profiles ?? [], "location"))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Kumpulan event "aktivitas": bikin circle, join circle, komen di grup
  const engagementEvents = [
    ...(circles ?? []).map((c) => ({ user_id: c.created_by, date: c.created_at })),
    ...(members ?? []).map((m) => ({ user_id: m.user_id, date: m.joined_at })),
    ...(comments ?? []).map((c) => ({ user_id: c.user_id, date: c.created_at })),
  ].filter((e) => e.user_id && e.date) as { user_id: string; date: string }[];

  const engagedUsersData = buildEngagementData(engagementEvents);
  const activityByWeekdayData = buildActivityByWeekday(engagementEvents.map((e) => e.date));

  // User Aktif = pernah join circle ATAU pernah bikin circle (unik per user)
  const activeUserIds = new Set<string>([
    ...(members ?? []).filter((m) => m.status === "joined").map((m) => m.user_id),
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

      {/* Section 1: KPI Cards + Gender + Status Circle */}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GenderPieChart data={genderData} />
        <CircleStatusDonutChart data={circleStatusData} />
      </div>

      {/* Section 2: Pertumbuhan User + Engaged Users (DAU/WAU/MAU) + Aktivitas Berdasarkan Waktu */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UserGrowthChart data={growthData} />
        <EngagedUsersChart data={engagedUsersData} />
        <ActivityByWeekdayChart data={activityByWeekdayData} />
      </div>

      {/* Section 3: Circle per Aktivitas + Top Aktivitas Disukai + User per Domisili */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CircleByCategoryBarChart data={circleByCategoryData} />
        <TopActivityBarChart data={topActivityData} />
        <UserByLocationBarChart data={userByLocationData} />
      </div>
    </div>
  );
}
