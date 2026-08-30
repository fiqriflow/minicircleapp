"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CircleCard, { Circle } from "@/components/CircleCard";
import CreateCircleModal from "@/components/CreateCircleModal";

const CATEGORIES = ["Semua", "Gowes", "Jalan Santai", "Running", "Lainnya"];

export default function ExplorePage() {
  const supabase = createClient();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [category, setCategory] = useState("Semua");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCircles = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("circles").select("*").eq("status", "active");

    if (category !== "Semua") query = query.eq("category", category);
    if (location.trim()) query = query.ilike("location", `%${location.trim()}%`);

    const { data } = await query.order("event_date", { ascending: true });
    setCircles((data as Circle[]) ?? []);
    setLoading(false);
  }, [category, location]);

  useEffect(() => {
    fetchCircles();
  }, [fetchCircles]);

  return (
    <div className="px-4 md:px-8 py-6 space-y-6 relative">
      <h1 className="text-xl font-bold">Explore Circle</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Cari lokasi terdekat..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
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
            circles.map((c) => <CircleCard key={c.id} circle={c} />)
          ) : (
            <p className="text-gray-400 text-sm">Tidak ada circle yang cocok.</p>
          )}
        </div>
      )}

      {/* Floating button tambah circle */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-24 right-5 md:bottom-8 md:right-8 z-30 bg-primary text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-primary-dark"
        aria-label="Tambah Circle"
      >
        <Plus size={26} />
      </button>

      {showCreate && (
        <CreateCircleModal onClose={() => setShowCreate(false)} onCreated={fetchCircles} />
      )}
    </div>
  );
}
