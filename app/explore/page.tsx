"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import CircleCard, { Circle } from "@/components/CircleCard";

const CATEGORIES = ["Semua", "Gowes", "Jalan Santai", "Running", "Lainnya"];

export default function ExplorePage() {
  const supabase = createClient();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [category, setCategory] = useState("Semua");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCircles = async () => {
      setLoading(true);
      let query = supabase.from("circles").select("*").eq("status", "active");

      if (category !== "Semua") query = query.eq("category", category);
      if (location.trim()) query = query.ilike("location", `%${location.trim()}%`);

      const { data } = await query.order("event_date", { ascending: true });
      setCircles((data as Circle[]) ?? []);
      setLoading(false);
    };
    fetchCircles();
  }, [category, location]);

  return (
    <div className="px-4 md:px-8 py-6 space-y-6">
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
    </div>
  );
}
