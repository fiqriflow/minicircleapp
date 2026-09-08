"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import ToggleSwitch from "@/components/ui/ToggleSwitch";

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
      toast.error("Masukkan angka yang valid.");
      return;
    }
    setSavingReg(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "registration_limit_count", value: String(n) });
    setSavingReg(false);
    if (error) {
      toast.error("Gagal menyimpan kuota: " + error.message);
      return;
    }
    toast.success(`Kuota pendaftar disimpan: ${n} user.`);
  };

  if (loading) return <p className="text-gray-400">Memuat...</p>;

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-xl font-bold">Pengaturan</h1>

      <div className="bg-white rounded-2xl border p-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium">Fitur Circle+</p>
          <p className="text-sm text-gray-400">
            Kalau dimatikan, pilihan Circle+ saat buat circle baru akan diarahkan ke halaman "Segera Hadir".
          </p>
        </div>
        <ToggleSwitch checked={circlePlusEnabled} onChange={handleToggle} disabled={saving} label="Toggle Circle+" />
      </div>

      <div className="bg-white rounded-2xl border p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium">Batasi Pendaftar Baru</p>
            <p className="text-sm text-gray-400">
              Kalau diaktifkan, pendaftaran akun baru ditolak otomatis setelah jumlah total user mencapai batas.
              User yang sudah terdaftar tidak terpengaruh.
            </p>
          </div>
          <ToggleSwitch
            checked={regLimitEnabled}
            onChange={handleToggleRegLimit}
            disabled={savingReg}
            label="Toggle Batasi Pendaftar Baru"
          />
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
