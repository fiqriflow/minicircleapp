"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCircleDisplayStatus } from "@/lib/circleStatus";

const CATEGORY_COLORS: Record<string, string> = {
  Jogging: "#f97316", // orange
  Gowes: "#3b82f6", // blue
  "Jalan Santai": "#22c55e", // green
};
const FALLBACK_COLOR = "#9ca3af"; // gray, untuk kategori lain di luar 3 di atas

type Stats = {
  totalJoin: number;
  totalHost: number;
  totalSelesai: number;
  totalBatal: number;
  categoryCounts: Record<string, number>;
};

export default function StatistikPage() {
  const supabase = createClient();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberships } = await supabase
        .from("circle_members")
        .select("circle:circles(id, category, status, event_date)")
        .eq("user_id", user.id)
        .eq("status", "joined");

      const joinedCircles = (memberships ?? []).map((m: any) => m.circle).filter(Boolean);

      const { count: hostCount } = await supabase
        .from("circles")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id);

      const totalSelesai = joinedCircles.filter((c: any) => getCircleDisplayStatus(c) === "completed").length;
      const totalBatal = joinedCircles.filter((c: any) => c.status === "cancelled").length;

      const categoryCounts: Record<string, number> = {};
      joinedCircles.forEach((c: any) => {
        if (c.category) categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      });

      setStats({
        totalJoin: joinedCircles.length,
        totalHost: hostCount ?? 0,
        totalSelesai,
        totalBatal,
        categoryCounts,
      });
    };
    load();
  }, []);

  if (!stats) return <p className="p-6 text-gray-400">Memuat...</p>;

  const categoryEntries = Object.entries(stats.categoryCounts) as [string, number][];
  const totalCategory = categoryEntries.reduce((sum, [, v]) => sum + v, 0);

  let acc = 0;
  const gradientParts = categoryEntries.map(([cat, count]) => {
    const start = (acc / totalCategory) * 360;
    acc += count;
    const end = (acc / totalCategory) * 360;
    const color = CATEGORY_COLORS[cat] || FALLBACK_COLOR;
    return `${color} ${start}deg ${end}deg`;
  });
  const conicGradient = gradientParts.length ? `conic-gradient(${gradientParts.join(", ")})` : "#e5e7eb";

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800" aria-label="Kembali">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">Statistik</h1>
      </div>

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-2xl font-bold text-primary">{stats.totalJoin}</p>
          <p className="text-xs text-gray-400 mt-1">Total Join Circle</p>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-2xl font-bold text-primary">{stats.totalHost}</p>
          <p className="text-xs text-gray-400 mt-1">Total Jadi Host/Pembuat</p>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-2xl font-bold text-gray-700">{stats.totalSelesai}</p>
          <p className="text-xs text-gray-400 mt-1">Total Circle Selesai</p>
        </div>
        <div className="bg-white rounded-2xl border p-4">
          <p className="text-2xl font-bold text-red-500">{stats.totalBatal}</p>
          <p className="text-xs text-gray-400 mt-1">Total Circle Batal</p>
        </div>
      </div>

      {/* Pie chart kategori */}
      <div className="bg-white rounded-2xl border p-4 space-y-4">
        <p className="text-sm font-semibold">Aktivitas Circle yang Diikuti</p>

        {totalCategory === 0 ? (
          <p className="text-sm text-gray-400">Belum ada data.</p>
        ) : (
          <div className="flex items-center gap-6">
            <div
              className="w-32 h-32 rounded-full shrink-0"
              style={{ background: conicGradient }}
              role="img"
              aria-label="Pie chart kategori circle yang diikuti"
            />
            <div className="space-y-2">
              {categoryEntries.map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] || FALLBACK_COLOR }}
                  />
                  <span className="text-gray-600">{cat}</span>
                  <span className="text-gray-400">
                    ({count} · {Math.round((count / totalCategory) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
