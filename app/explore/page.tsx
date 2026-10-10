"use client";

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { CIRCLE_WITH_HOST } from "@/lib/circleColumns";
import { createClient } from "@/lib/supabase/client";
import CircleCard, { Circle } from "@/components/circle/CircleCard";
import CreateCircleModal from "@/components/circle/CreateCircleModal";
import ChooseCircleTypeModal from "@/components/circle/ChooseCircleTypeModal";
import CircleCreatedDialog from "@/components/circle/CircleCreatedDialog";
import LocationInput from "@/components/ui/LocationInput";
import { getCirclePlusEnabled, getDefaultCoverMap } from "@/lib/appSettings";
import { getJoinedCounts } from "@/lib/circleMembers";
import { toast } from "sonner";

const CATEGORIES = ["Semua", "Gowes", "Jalan Santai", "Jogging", "Kulineran", "Ngopi", "Explore Alam"];
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_SHOWN = 14;
const PAGE_SIZE = 30;

// Escape karakter wildcard LIKE (\\ % _) supaya input user dicari apa adanya
const escLike = (v: string) => v.replace(/[\\%_]/g, (m) => "\\" + m);

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function ExploreContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category");
  const [circles, setCircles] = useState<Circle[]>([]);
  const [category, setCategory] = useState(
    CATEGORIES.includes(initialCategory ?? "") ? (initialCategory as string) : "Semua"
  );
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [eventDays, setEventDays] = useState<Set<string>>(new Set());
  const requestId = useRef(0);
  // list pertama menunggu profil (lokasi default) supaya tidak fetch dua kali + berkedip
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showChooser, setShowChooser] = useState(false);
  const [createType, setCreateType] = useState<"regular" | "plus" | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [defaultCoverMap, setDefaultCoverMap] = useState<Record<string, string>>({});
  const [circlePlusEnabled, setCirclePlusEnabled] = useState(true);
  const [joinedCounts, setJoinedCounts] = useState<Record<string, number>>({});
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    getDefaultCoverMap(supabase).then(setDefaultCoverMap);
    getCirclePlusEnabled(supabase).then(setCirclePlusEnabled);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      // profil & memberships tidak saling bergantung -> paralel
      const [{ data }, { data: memberships }] = await Promise.all([
        supabase.from("profiles").select("location").eq("id", user.id).single(),
        supabase.from("circle_members").select("circle_id").eq("user_id", user.id).eq("status", "joined"),
      ]);
      if (data?.location) setLocation((prev) => prev || data.location);
      setJoinedIds(new Set((memberships ?? []).map((m) => m.circle_id)));
    };
    loadUserData().catch(() => {}).finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Query dasar: semua filter dikerjakan di DB (bukan filter client atas data yang sudah ditarik semua).
  const buildQuery = useCallback(
    (columns: string, withCount = false) => {
      const now = new Date();
      let from = now;
      let to: Date | null = null;
      if (selectedDate) {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        to = new Date(dayStart);
        to.setDate(to.getDate() + 1);
        if (dayStart > now) from = dayStart;
      }
      let q = supabase
        .from("circles")
        .select(columns, withCount ? { count: "exact" } : undefined)
        .eq("status", "active")
        .eq("is_private", false)
        .gte("event_date", from.toISOString());
      if (to) q = q.lt("event_date", to.toISOString());
      if (category !== "Semua") q = q.eq("category", category);
      if (location.trim()) q = q.ilike("city", `%${escLike(location.trim())}%`);
      if (debouncedSearch) {
        q = q.ilike("name", `%${escLike(debouncedSearch)}%`);
      }
      return q.order("event_date", { ascending: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, location, debouncedSearch, selectedDate]
  );

  const fetchCircles = useCallback(async () => {
    const myRequest = ++requestId.current;
    setLoading(true);
    const { data, count, error } = await buildQuery(CIRCLE_WITH_HOST, true).range(0, PAGE_SIZE - 1);
    if (myRequest !== requestId.current) return; // ada request lebih baru -> abaikan hasil lama
    if (error) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoadError(false);
    const rows = (data as unknown as Circle[]) ?? [];
    setCircles(rows);
    setTotalCount(count ?? rows.length);
    setLoading(false);

    const counts = await getJoinedCounts(supabase, rows.map((c) => c.id));
    if (myRequest !== requestId.current) return;
    setJoinedCounts(counts);
  }, [buildQuery]);

  const loadMore = async () => {
    if (loadingMore || loading) return;
    const myRequest = requestId.current;
    setLoadingMore(true);
    const { data, error } = await buildQuery(CIRCLE_WITH_HOST).range(circles.length, circles.length + PAGE_SIZE - 1);
    if (myRequest !== requestId.current) {
      setLoadingMore(false);
      return;
    }
    if (error) {
      toast.error("Gagal memuat circle lainnya. Coba lagi.");
      setLoadingMore(false);
      return;
    }
    const rows = (data as unknown as Circle[]) ?? [];
    if (rows.length === 0) {
      // total yang tersimpan sudah basi (circle dihapus/dibatalkan) -> sembunyikan tombol "Muat lebih banyak"
      setTotalCount(circles.length);
      setLoadingMore(false);
      return;
    }
    const counts = await getJoinedCounts(supabase, rows.map((c) => c.id));
    if (myRequest !== requestId.current) {
      setLoadingMore(false);
      return;
    }
    setCircles((prev) => {
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...rows.filter((c) => !seen.has(c.id))];
    });
    setJoinedCounts((prev) => ({ ...prev, ...counts }));
    setLoadingMore(false);
  };

  useEffect(() => {
    if (ready) fetchCircles();
  }, [fetchCircles, ready]);

  // Titik penanda tanggal di date strip: query ringan (hanya event_date, 14 hari ke depan),
  // supaya tetap akurat walau daftar circle dipaginasi.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const run = async () => {
      const start = new Date();
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + DAYS_SHOWN);
      let q = supabase
        .from("circles")
        .select("event_date")
        .eq("status", "active")
        .eq("is_private", false)
        .gte("event_date", start.toISOString())
        .lt("event_date", end.toISOString());
      if (category !== "Semua") q = q.eq("category", category);
      if (location.trim()) q = q.ilike("city", `%${escLike(location.trim())}%`);
      const { data } = await q.limit(500);
      if (cancelled) return;
      setEventDays(new Set((data ?? []).map((r: any) => new Date(r.event_date).toDateString())));
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, location, ready]);

  const dateStrip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_SHOWN }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      return { date: d, hasEvent: eventDays.has(d.toDateString()) };
    });
  }, [eventDays]);

  const filteredCircles = circles;

  const monthLabel = selectedDate ? selectedDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "";

  return (
    <div className="px-4 py-6 space-y-6 relative">
      <h1 className="text-xl font-bold">Explore Circle</h1>

      {/* Search by name */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama circle..."
          className="w-full border rounded-xl pl-10 pr-4 py-2"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <LocationInput
          id="explore-city-list"
          value={location}
          onChange={setLocation}
          placeholder="Cari lokasi terdekat..."
          className="border rounded-xl px-4 py-2 flex-1"
          strict={false}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded-xl px-4 py-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c === "Semua" ? "Semua Aktivitas" : c}</option>
          ))}
        </select>
      </div>

      {/* Date scroller */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500">Pilih Tanggal</h2>
          <span className="text-sm text-gray-400">{monthLabel}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setSelectedDate(null)}
            className={`flex flex-col items-center justify-center shrink-0 w-14 h-16 rounded-xl border text-xs font-medium ${
              selectedDate === null ? "bg-primary text-white border-primary" : "bg-white text-gray-600 hover:border-primary"
            }`}
          >
            Semua
          </button>
          {dateStrip.map(({ date, hasEvent }) => {
            const active = selectedDate !== null && isSameDay(date, selectedDate);
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center shrink-0 w-14 h-16 rounded-xl border ${
                  active ? "bg-primary text-white border-primary" : "bg-white text-gray-600 hover:border-primary"
                }`}
              >
                <span className="text-[10px] opacity-80">{DAY_LABELS[date.getDay()]}</span>
                <span className="text-lg font-semibold">{date.getDate()}</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    hasEvent ? (active ? "bg-white" : "bg-primary") : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Jumlah circle ditemukan */}
      <p className="text-sm text-gray-500">
        <span className="font-semibold text-gray-700">{totalCount}</span> circle ditemukan
      </p>

      {/* Grid */}
      {loading || !ready ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : loadError ? (
        <div className="text-center space-y-2 py-4">
          <p className="text-sm text-gray-500">Gagal memuat circle. Cek koneksi kamu.</p>
          <button onClick={fetchCircles} className="text-sm font-medium text-primary">
            Coba lagi
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCircles.length ? (
            filteredCircles.map((c) => (
              <CircleCard key={c.id} circle={c} defaultCoverMap={defaultCoverMap} joinedCount={joinedCounts[c.id]} currentUserId={currentUserId} isJoined={joinedIds.has(c.id)} />
            ))
          ) : (
            <p className="text-gray-400 text-sm">
              {debouncedSearch
                ? "Tidak ada circle dengan nama tersebut."
                : selectedDate === null
                ? "Tidak ada circle yang cocok."
                : "Tidak ada circle di tanggal ini."}
            </p>
          )}
          {circles.length < totalCount && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full border rounded-xl py-2 text-sm font-medium text-primary disabled:opacity-50"
            >
              {loadingMore ? "Memuat..." : "Muat lebih banyak"}
            </button>
          )}
        </div>
      )}

      {/* Floating button tambah circle */}
      <button
        onClick={() => setShowChooser(true)}
        className="fixed bottom-24 right-5 z-30 bg-primary text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-primary-dark"
        aria-label="Tambah Circle"
      >
        <Plus size={26} />
      </button>

      {showChooser && (
        <ChooseCircleTypeModal
          circlePlusEnabled={circlePlusEnabled}
          onClose={() => setShowChooser(false)}
          onChoose={(type) => {
            setCreateType(type);
            setShowChooser(false);
          }}
        />
      )}

      {createType && (
        <CreateCircleModal
          circleType={createType}
          onClose={() => setCreateType(null)}
          onCreated={() => {
            fetchCircles();
            setShowSuccess(true);
          }}
        />
      )}

      {showSuccess && <CircleCreatedDialog onClose={() => setShowSuccess(false)} />}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<p className="p-6 text-gray-400">Memuat...</p>}>
      <ExploreContent />
    </Suspense>
  );
}
