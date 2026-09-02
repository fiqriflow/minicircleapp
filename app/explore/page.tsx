"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CircleCard, { Circle } from "@/components/CircleCard";
import CreateCircleModal from "@/components/CreateCircleModal";
import ChooseCircleTypeModal from "@/components/ChooseCircleTypeModal";
import LocationInput from "@/components/LocationInput";
import { getCirclePlusEnabled, getDefaultCoverMap } from "@/lib/appSettings";
import { getJoinedCounts } from "@/lib/circleMembers";

const CATEGORIES = ["Semua", "Gowes", "Jalan Santai", "Running"];

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

  useEffect(() => {
    getDefaultCoverMap(supabase).then(setDefaultCoverMap);
    getCirclePlusEnabled(supabase).then(setCirclePlusEnabled);
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

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 relative">
      <h1 className="text-xl font-bold">Explore Circle</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <LocationInput
          id="explore-city-list"
          value={location}
          onChange={setLocation}
          placeholder="Cari lokasi terdekat..."
          className="border rounded-xl px-4 py-2 flex-1"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded-xl px-4 py-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {circles.length ? (
            circles.map((c) => (
              <CircleCard key={c.id} circle={c} defaultCoverMap={defaultCoverMap} joinedCount={joinedCounts[c.id]} />
            ))
          ) : (
            <p className="text-gray-400 text-sm">Tidak ada circle yang cocok.</p>
          )}
        </div>
      )}

      {/* Floating button tambah circle */}
      <button
        onClick={() => setShowChooser(true)}
        className="fixed bottom-24 right-5 md:bottom-8 md:right-8 z-30 bg-primary text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-primary-dark"
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
