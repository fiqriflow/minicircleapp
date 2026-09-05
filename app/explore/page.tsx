"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CircleCard, { Circle } from "@/components/CircleCard";
import CreateCircleModal from "@/components/CreateCircleModal";
import ChooseCircleTypeModal from "@/components/ChooseCircleTypeModal";
import LocationInput from "@/components/LocationInput";
import { getCirclePlusEnabled, getDefaultCoverMap } from "@/lib/appSettings";
import { getJoinedCounts } from "@/lib/circleMembers";

const CATEGORIES = ["Semua", "Gowes", "Jalan Santai", "Jogging", "Kulineran", "Ngopi", "Explore Alam", "Motoran"];
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_SHOWN = 14;

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
  const [loading, setLoading] = useState(true);
  const [showChooser, setShowChooser] = useState(false);
  const [createType, setCreateType] = useState<"regular" | "plus" | null>(null);
  const [defaultCoverMap, setDefaultCoverMap] = useState<Record<string, string>>({});
  const [circlePlusEnabled, setCirclePlusEnabled] = useState(true);
  const [joinedCounts, setJoinedCounts] = useState<Record<string, number>>({});
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
    const loadUserLocation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("location").eq("id", user.id).single();
      if (data?.location) setLocation((prev) => prev || data.location);
    };
    loadUserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCircles = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("circles")
      .select("*")
      .eq("status", "active")
      .eq("is_private", false)
      .gte("event_date", new Date().toISOString());

    if (category !== "Semua") query = query.eq("category", category);
    if (location.trim()) query = query.ilike("city", `%${location.trim()}%`);

    const { data } = await query.order("event_date", { ascending: true });
    setCircles((data as Circle[]) ?? []);
    setLoading(false);

    const counts = await getJoinedCounts(supabase, (data ?? []).map((c: any) => c.id));
    setJoinedCounts(counts);
  }, [category, location]);

  useEffect(() => {
    fetchCircles();
  }, [fetchCircles]);

  const dateStrip = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_SHOWN }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const hasEvent = circles.some((c) => isSameDay(new Date(c.event_date), d));
      return { date: d, hasEvent };
    });
  }, [circles]);

  const filteredCircles = useMemo(
    () => (selectedDate === null ? circles : circles.filter((c) => isSameDay(new Date(c.event_date), selectedDate))),
    [circles, selectedDate]
  );

  const monthLabel = selectedDate ? selectedDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" }) : "";

  return (
    <div className="px-4 py-6 space-y-6 relative">
      <h1 className="text-xl font-bold">Explore Circle</h1>

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
        <span className="font-semibold text-gray-700">{filteredCircles.length}</span> circle ditemukan
      </p>

      {/* Grid */}
      {loading ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCircles.length ? (
            filteredCircles.map((c) => (
              <CircleCard key={c.id} circle={c} defaultCoverMap={defaultCoverMap} joinedCount={joinedCounts[c.id]} />
            ))
          ) : (
            <p className="text-gray-400 text-sm">
              {selectedDate === null ? "Tidak ada circle yang cocok." : "Tidak ada circle di tanggal ini."}
            </p>
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
          onCreated={fetchCircles}
        />
      )}
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
