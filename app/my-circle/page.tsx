"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CircleCard, { Circle } from "@/components/CircleCard";
import { getDefaultCoverMap } from "@/lib/appSettings";
import { getCircleDisplayStatus } from "@/lib/circleStatus";
import { getJoinedCounts } from "@/lib/circleMembers";

type Tab = "host" | "active" | "completed";

export default function MyCirclePage() {
  const supabase = createClient();
  const [hosted, setHosted] = useState<Circle[]>([]);
  const [active, setActive] = useState<Circle[]>([]);
  const [completed, setCompleted] = useState<Circle[]>([]);
  const [tab, setTab] = useState<Tab>("host");
  const [loading, setLoading] = useState(true);
  const [defaultCoverMap, setDefaultCoverMap] = useState<Record<string, string>>({});
  const [joinedCounts, setJoinedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getDefaultCoverMap(supabase).then(setDefaultCoverMap);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [{ data: hostedCircles }, { data: memberships }] = await Promise.all([
        supabase.from("circles").select("*").eq("created_by", user.id),
        supabase
          .from("circle_members")
          .select("circle:circles(*)")
          .eq("user_id", user.id)
          .eq("status", "joined"),
      ]);

      const hostedAll = (hostedCircles ?? []) as Circle[];
      const joinedAll = (memberships?.map((m: any) => m.circle).filter(Boolean) ?? []) as Circle[];

      // Circle yang di-host tapi juga sempat di-join sendiri (host otomatis masuk lineup)
      // tidak dobel ditampilkan di tab Sedang Diikuti — cukup di tab Host.
      const hostedIds = new Set(hostedAll.map((c) => c.id));
      const joinedOnly = joinedAll.filter((c) => !hostedIds.has(c.id));

      setHosted(hostedAll.filter((c: any) => ["open", "full", "ongoing"].includes(getCircleDisplayStatus(c))));
      setActive(joinedOnly.filter((c: any) => ["open", "full", "ongoing"].includes(getCircleDisplayStatus(c))));

      const allForCompleted = [...hostedAll, ...joinedOnly];
      const completedMap = new Map(
        allForCompleted
          .filter((c: any) => ["completed", "cancelled"].includes(getCircleDisplayStatus(c)))
          .map((c) => [c.id, c])
      );
      setCompleted(Array.from(completedMap.values()));

      setLoading(false);

      const allIds = [...hostedAll, ...joinedOnly].map((c: any) => c.id);
      const counts = await getJoinedCounts(supabase, allIds);
      setJoinedCounts(counts);
    };
    load();
  }, []);

  const list = tab === "host" ? hosted : tab === "active" ? active : completed;

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">My Circle</h1>

      <div className="flex border-b">
        <button
          onClick={() => setTab("host")}
          className={`flex-1 py-2 font-medium text-sm ${tab === "host" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Host ({hosted.length})
        </button>
        <button
          onClick={() => setTab("active")}
          className={`flex-1 py-2 font-medium text-sm ${tab === "active" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Sedang Diikuti ({active.length})
        </button>
        <button
          onClick={() => setTab("completed")}
          className={`flex-1 py-2 font-medium text-sm ${tab === "completed" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Selesai ({completed.length})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {list.length ? (
            list.map((c) => (
              <CircleCard key={c.id} circle={c} defaultCoverMap={defaultCoverMap} joinedCount={joinedCounts[c.id]} />
            ))
          ) : (
            <p className="text-gray-400 text-sm">
              {tab === "host"
                ? "Belum jadi host circle apapun."
                : tab === "active"
                ? "Belum join circle apapun."
                : "Belum ada riwayat circle."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
