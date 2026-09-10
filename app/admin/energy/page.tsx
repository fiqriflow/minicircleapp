"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MAX_ENERGY, getNextResetLabel } from "@/lib/energy";

export default function AdminEnergyPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("admin_player_view")
      .select("id, full_name, nickname, email, avatar_url, energy, energy_reset_at")
      .order("full_name", { ascending: true });
    if (error) {
      toast.error("Gagal memuat data energy: " + error.message);
      return;
    }
    setPlayers(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const adjustEnergy = async (player: any, delta: number) => {
    const next = Math.max(0, Math.min(MAX_ENERGY, (player.energy ?? 0) + delta));
    setBusyId(player.id);
    const { error } = await supabase.from("profiles").update({ energy: next }).eq("id", player.id);
    setBusyId(null);
    if (error) {
      toast.error("Gagal ubah energy: " + error.message);
      return;
    }
    setPlayers((prev) => prev.map((p) => (p.id === player.id ? { ...p, energy: next } : p)));
    toast.success(`Energy ${player.full_name || player.nickname || "user"} sekarang ${next}/${MAX_ENERGY}.`);
  };

  const resetEnergy = async (player: any) => {
    if (!confirm(`Reset energy "${player.full_name || player.nickname}" ke ${MAX_ENERGY}?`)) return;
    setBusyId(player.id);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ energy: MAX_ENERGY, energy_reset_at: nowIso })
      .eq("id", player.id);
    setBusyId(null);
    if (error) {
      toast.error("Gagal reset energy: " + error.message);
      return;
    }
    setPlayers((prev) =>
      prev.map((p) => (p.id === player.id ? { ...p, energy: MAX_ENERGY, energy_reset_at: nowIso } : p))
    );
    toast.success(`Energy ${player.full_name || player.nickname || "user"} berhasil di-reset.`);
  };

  const displayed = players.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [p.full_name, p.nickname, p.email].filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Energy</h1>
          <p className="text-sm text-gray-500">
            Energy dipakai user tiap buat circle baru (-1). Reset otomatis ke {MAX_ENERGY} tiap Senin 00.00 WIB —
            reset otomatis berikutnya: <span className="font-medium">{getNextResetLabel()}</span>.
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, email..."
          className="border rounded-xl px-3 py-2 text-sm w-56"
        />
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {displayed.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <img
                src={p.avatar_url || "https://ui-avatars.com/api/?name=" + (p.full_name || "U")}
                alt=""
                className="w-10 h-10 rounded-full object-cover border"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.full_name || p.nickname || "-"}</p>
                <p className="text-xs text-gray-500 truncate">{p.email || "-"}</p>
              </div>
              <span className="text-sm font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full shrink-0">
                ⚡ {p.energy}/{MAX_ENERGY}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => adjustEnergy(p, -1)}
                disabled={busyId === p.id || p.energy <= 0}
                className="flex-1 py-2 rounded-xl border text-sm font-medium disabled:opacity-40"
              >
                -1
              </button>
              <button
                onClick={() => adjustEnergy(p, 1)}
                disabled={busyId === p.id || p.energy >= MAX_ENERGY}
                className="flex-1 py-2 rounded-xl border text-sm font-medium disabled:opacity-40"
              >
                +1
              </button>
              <button
                onClick={() => resetEnergy(p)}
                disabled={busyId === p.id}
                className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-40"
              >
                Reset
              </button>
            </div>
          </div>
        ))}
        {!displayed.length && <p className="text-gray-400 text-sm">{search ? "Tidak ada yang cocok." : "Belum ada user."}</p>}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">User</th>
              <th className="p-3">Email</th>
              <th className="p-3">Energy</th>
              <th className="p-3">Reset Terakhir</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={p.avatar_url || "https://ui-avatars.com/api/?name=" + (p.full_name || "U")}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border"
                    />
                    <span>{p.full_name || p.nickname || "-"}</span>
                  </div>
                </td>
                <td className="p-3">{p.email}</td>
                <td className="p-3">
                  <span className="font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                    ⚡ {p.energy}/{MAX_ENERGY}
                  </span>
                </td>
                <td className="p-3 text-gray-500">
                  {p.energy_reset_at ? new Date(p.energy_reset_at).toLocaleString("id-ID") : "-"}
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => adjustEnergy(p, -1)}
                      disabled={busyId === p.id || p.energy <= 0}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-40"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => adjustEnergy(p, 1)}
                      disabled={busyId === p.id || p.energy >= MAX_ENERGY}
                      className="px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-40"
                    >
                      +1
                    </button>
                    <button
                      onClick={() => resetEnergy(p)}
                      disabled={busyId === p.id}
                      className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-40"
                    >
                      Reset ke {MAX_ENERGY}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!displayed.length && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400">
                  {search ? "Tidak ada yang cocok." : "Belum ada user."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
