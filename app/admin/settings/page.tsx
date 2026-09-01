"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [circlePlusEnabled, setCirclePlusEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "circle_plus_enabled").maybeSingle();
      setCirclePlusEnabled(data ? data.value !== "false" : true);
      setLoading(false);
    };
    load();
  }, []);

  const handleToggle = async () => {
    const next = !circlePlusEnabled;
    setSaving(true);
    setCirclePlusEnabled(next);
    await supabase.from("app_settings").upsert({ key: "circle_plus_enabled", value: String(next) });
    setSaving(false);
  };

  if (loading) return <p className="text-gray-400">Memuat...</p>;

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-xl font-bold">Pengaturan</h1>

      <div className="bg-white rounded-2xl border p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">Fitur Circle+</p>
          <p className="text-sm text-gray-400">
            Kalau dimatikan, pilihan Circle+ saat buat circle baru akan diarahkan ke halaman "Segera Hadir".
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`shrink-0 w-14 h-8 rounded-full transition-colors relative ${
            circlePlusEnabled ? "bg-primary" : "bg-gray-300"
          }`}
          aria-label="Toggle Circle+"
        >
          <span
            className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              circlePlusEnabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
