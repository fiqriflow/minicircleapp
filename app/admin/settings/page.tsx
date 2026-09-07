"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [circlePlusEnabled, setCirclePlusEnabled] = useState(true);
  const [regLimitEnabled, setRegLimitEnabled] = useState(false);
  const [regLimitCount, setRegLimitCount] = useState("1000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReg, setSavingReg] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", ["circle_plus_enabled", "registration_limit_enabled", "registration_limit_count"]);
      const map: Record<string, string> = {};
      data?.forEach((row) => (map[row.key] = row.value));
      setCirclePlusEnabled(map.circle_plus_enabled !== "false");
      setRegLimitEnabled(map.registration_limit_enabled === "true");
      setRegLimitCount(map.registration_limit_count ?? "1000");
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

  const handleToggleRegLimit = async () => {
    const next = !regLimitEnabled;
    setSavingReg(true);
    setRegLimitEnabled(next);
    await supabase.from("app_settings").upsert({ key: "registration_limit_enabled", value: String(next) });
    setSavingReg(false);
  };

  const handleSaveRegLimitCount = async () => {
    const n = Number(regLimitCount);
    if (!Number.isFinite(n) || n < 0) {
      alert("Masukkan angka yang valid.");
      return;
    }
    setSavingReg(true);
    await supabase.from("app_settings").upsert({ key: "registration_limit_count", value: String(n) });
    setSavingReg(false);
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

      <div className="bg-white rounded-2xl border p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Batasi Pendaftar Baru</p>
            <p className="text-sm text-gray-400">
              Kalau diaktifkan, pendaftaran akun baru ditolak otomatis setelah jumlah total user mencapai batas.
              User yang sudah terdaftar tidak terpengaruh.
            </p>
          </div>
          <button
            onClick={handleToggleRegLimit}
            disabled={savingReg}
            className={`shrink-0 w-14 h-8 rounded-full transition-colors relative ${
              regLimitEnabled ? "bg-primary" : "bg-gray-300"
            }`}
            aria-label="Toggle Batasi Pendaftar Baru"
          >
            <span
              className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                regLimitEnabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={regLimitCount}
            onChange={(e) => setRegLimitCount(e.target.value)}
            className="border rounded-xl px-4 py-2 w-full"
            placeholder="Jumlah maksimal user"
          />
          <button
            onClick={handleSaveRegLimitCount}
            disabled={savingReg}
            className="bg-primary text-white px-4 py-2 rounded-xl text-sm shrink-0"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
