"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CircleCard, { Circle } from "@/components/CircleCard";
import { getDefaultCircleCover } from "@/lib/appSettings";
import { getCircleDisplayStatus } from "@/lib/circleStatus";

export default function MyCirclePage() {
  const supabase = createClient();
  const [active, setActive] = useState<Circle[]>([]);
  const [completed, setCompleted] = useState<Circle[]>([]);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [loading, setLoading] = useState(true);
  const [defaultCoverUrl, setDefaultCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    getDefaultCircleCover(supabase).then(setDefaultCoverUrl);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: memberships } = await supabase
        .from("circle_members")
        .select("circle:circles(*)")
        .eq("user_id", user?.id)
        .eq("status", "joined");

      const all = (memberships?.map((m: any) => m.circle).filter(Boolean) ?? []) as Circle[];
      setActive(all.filter((c: any) => getCircleDisplayStatus(c) === "active"));
      setCompleted(all.filter((c: any) => getCircleDisplayStatus(c) !== "active"));
      setLoading(false);
    };
    load();
  }, []);

  const list = tab === "active" ? active : completed;

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
      <h1 className="text-xl font-bold">My Circle</h1>

      <div className="flex border-b">
        <button
          onClick={() => setTab("active")}
          className={`flex-1 py-2 font-medium ${tab === "active" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Sedang Diikuti ({active.length})
        </button>
        <button
          onClick={() => setTab("completed")}
          className={`flex-1 py-2 font-medium ${tab === "completed" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Selesai ({completed.length})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.length ? (
            list.map((c) => <CircleCard key={c.id} circle={c} defaultCoverUrl={defaultCoverUrl} />)
          ) : (
            <p className="text-gray-400 text-sm">
              {tab === "active" ? "Belum join circle apapun." : "Belum ada riwayat circle."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
