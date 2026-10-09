"use client";

import { Suspense, useEffect, useState } from "react";
import { CIRCLE_COLUMNS } from "@/lib/circleColumns";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CircleCard, { Circle } from "@/components/circle/CircleCard";
import { getDefaultCoverMap } from "@/lib/appSettings";
import { getCircleDisplayStatus } from "@/lib/circleStatus";
import { getJoinedCounts } from "@/lib/circleMembers";

type Tab = "host" | "active" | "completed";
const VALID_TABS: Tab[] = ["host", "active", "completed"];

const ts = (c: Circle) => new Date(c.event_date).getTime();
const byDateAsc = (a: Circle, b: Circle) => ts(a) - ts(b); // yang paling dekat dulu
const byDateDesc = (a: Circle, b: Circle) => ts(b) - ts(a); // riwayat: yang terbaru dulu

function MyCircleContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [hosted, setHosted] = useState<Circle[]>([]);
  const [active, setActive] = useState<Circle[]>([]);
  const [completed, setCompleted] = useState<Circle[]>([]);
  const [tab, setTab] = useState<Tab>(
    VALID_TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "host"
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [defaultCoverMap, setDefaultCoverMap] = useState<Record<string, string>>({});
  const [joinedCounts, setJoinedCounts] = useState<Record<string, number>>({});
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getDefaultCoverMap(supabase).then(setDefaultCoverMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
      setLoadError(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // joined + pending: permintaan join yang belum disetujui host juga harus bisa ditemukan di sini
      const [{ data: hostedCircles, error: hostedError }, { data: memberships, error: memberError }] = await Promise.all([
        supabase.from("circles").select(CIRCLE_COLUMNS).eq("created_by", user.id),
        supabase
          .from("circle_members")
          .select(`status, circle:circles(${CIRCLE_COLUMNS})`)
          .eq("user_id", user.id)
          .in("status", ["joined", "pending"]),
      ]);

      if (hostedError || memberError) {
        setLoadError(true);
        setLoading(false);
        return;
      }

      const hostedAll = (hostedCircles ?? []) as Circle[];
      const memberRows = (memberships ?? []).filter((m: any) => m.circle) as any[];
      const joinedAll = memberRows.filter((m) => m.status === "joined").map((m) => m.circle) as Circle[];
      const pendingAll = memberRows.filter((m) => m.status === "pending").map((m) => m.circle) as Circle[];

      // Circle yang di-host tapi juga sempat di-join sendiri (host otomatis masuk lineup)
      // tidak dobel ditampilkan di tab Sedang Diikuti — cukup di tab Host.
      const hostedIds = new Set(hostedAll.map((c) => c.id));
      const joinedOnly = joinedAll.filter((c) => !hostedIds.has(c.id));
      setJoinedIds(new Set(joinedOnly.map((c) => c.id)));

      const isLive = (c: any) => ["open", "full", "ongoing"].includes(getCircleDisplayStatus(c));
      const pendingLive = pendingAll.filter(isLive).filter((c) => !hostedIds.has(c.id));
      setPendingIds(new Set(pendingLive.map((c) => c.id)));

      setHosted(hostedAll.filter(isLive).sort(byDateAsc));
      setActive([...joinedOnly.filter(isLive), ...pendingLive].sort(byDateAsc));

      const allForCompleted = [...hostedAll, ...joinedOnly];
      const completedMap = new Map(
        allForCompleted
          .filter((c: any) => ["completed", "cancelled"].includes(getCircleDisplayStatus(c)))
          .map((c) => [c.id, c])
      );
      setCompleted(Array.from(completedMap.values()).sort(byDateDesc));

      setLoading(false);

      const allIds = [...hostedAll, ...joinedOnly, ...pendingLive].map((c: any) => c.id);
      const counts = await getJoinedCounts(supabase, allIds);
      setJoinedCounts(counts);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sinkronkan tab ke URL: setelah buka circle lalu tekan Kembali, tab terakhir tetap terbuka
  const changeTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `?tab=${t}`);
  };

  const list = tab === "host" ? hosted : tab === "active" ? active : completed;

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">My Circle</h1>

      <div className="flex border-b">
        <button
          onClick={() => changeTab("host")}
          className={`flex-1 py-2 font-medium text-sm ${tab === "host" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Host ({hosted.length})
        </button>
        <button
          onClick={() => changeTab("active")}
          className={`flex-1 py-2 font-medium text-sm ${tab === "active" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Sedang Diikuti ({active.length})
        </button>
        <button
          onClick={() => changeTab("completed")}
          className={`flex-1 py-2 font-medium text-sm ${tab === "completed" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Selesai ({completed.length})
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : loadError ? (
        <div className="text-center space-y-2 py-4">
          <p className="text-sm text-gray-500">Gagal memuat circle kamu. Cek koneksi.</p>
          <button
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="text-sm font-medium text-primary"
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {list.length ? (
            list.map((c) => (
              <CircleCard key={c.id} circle={c} defaultCoverMap={defaultCoverMap} joinedCount={joinedCounts[c.id]} currentUserId={currentUserId} isJoined={joinedIds.has(c.id)} isPending={pendingIds.has(c.id)} />
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

export default function MyCirclePage() {
  return (
    <Suspense fallback={<p className="p-6 text-gray-400">Memuat...</p>}>
      <MyCircleContent />
    </Suspense>
  );
}
