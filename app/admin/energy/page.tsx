"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ENERGY_COST, DAILY_ENERGY_BONUS, getNextBonusLabel } from "@/lib/energy";

const QUICK_ADD = [10, 100, 1000];

export default function AdminEnergyPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const load = async () => {
    const { data, error } = await supabase
      .rpc("admin_get_players")
      .select("id, full_name, nickname, email, avatar_url, energy, energy_reset_at")
      .order("full_name", { ascending: true });
    if (error) {
      toast.error("Gagal memuat data energy: " + error.message);
      return;
    }
    setPlayers((data as any[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameOf = (p: any) => p.full_name || p.nickname || "user";

  // Atomik di DB (admin_adjust_energy): aman walau user sedang memakai energy di saat yang sama.
  const adjustEnergy = async (player: any, delta: number) => {
    if (!Number.isInteger(delta) || delta === 0) {
      toast.error("Isi jumlah energy (angka bulat, bukan 0).");
      return;
    }
    setBusyId(player.id);
    const { data, error } = await supabase.rpc("admin_adjust_energy", {
      p_user_id: player.id,
      p_delta: delta,
    });
    setBusyId(null);
    if (error) {
      toast.error("Gagal ubah energy: " + error.message);
      return;
    }
    const next = typeof data === "number" ? data : Math.max(0, (player.energy ?? 0) + delta);
    setPlayers((prev) => prev.map((p) => (p.id === player.id ? { ...p, energy: next } : p)));
    toast.success(`Energy ${nameOf(player)} sekarang ${next} (${delta > 0 ? "+" : ""}${delta}).`);
  };

  const amountOf = (id: string) => parseInt(amounts[id] ?? "", 10);

  const displayed = players.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [p.full_name, p.nickname, p.email].filter(Boolean).some((v: string) => v.toLowerCase().includes(q));
  });

  const Controls = ({ p }: { p: any }) => (
    <div className="space-y-2">
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={amounts[p.id] ?? ""}
          onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
          placeholder="Jumlah"
          className="border rounded-lg px-3 py-1.5 text-sm w-24"
        />
        <button
          onClick={() => adjustEnergy(p, amountOf(p.id))}
          disabled={busyId === p.id || !(amountOf(p.id) > 0)}
          className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-40"
        >
          Tambah
        </button>
        <button
          onClick={() => adjustEnergy(p, -amountOf(p.id))}
          disabled={busyId === p.id || !(amountOf(p.id) > 0)}
          className="px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-40"
        >
          Kurangi
        </button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {QUICK_ADD.map((n) => (
          <button
            key={n}
            onClick={() => adjustEnergy(p, n)}
            disabled={busyId === p.id}
            className="px-2.5 py-1 rounded-full border text-xs text-gray-600 disabled:opacity-40"
          >
            +{n}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Energy</h1>
          <p className="text-sm text-gray-500">
            Energy = saldo kredit. Join circle -{ENERGY_COST.join}, buat circle -{ENERGY_COST.create}, buat circle plus -
            {ENERGY_COST.createPlus}. Bonus +{DAILY_ENERGY_BONUS} tiap hari 00.00 WIB (menumpuk), berikutnya{" "}
            <span className="font-medium">{getNextBonusLabel()}</span>. User yang kehabisan energy minta tambahan ke admin.
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
              <img loading="lazy" decoding="async"
                src={p.avatar_url || "https://ui-avatars.com/api/?name=" + (p.full_name || "U")}
                alt=""
                className="w-10 h-10 rounded-full object-cover border"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.full_name || p.nickname || "-"}</p>
                <p className="text-xs text-gray-500 truncate">{p.email || "-"}</p>
              </div>
              <span className="text-sm font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full shrink-0">
                ⚡ {p.energy}
              </span>
            </div>
            <Controls p={p} />
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
              <th className="p-3">Bonus Terakhir</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((p) => (
              <tr key={p.id} className="border-t align-top">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <img loading="lazy" decoding="async"
                      src={p.avatar_url || "https://ui-avatars.com/api/?name=" + (p.full_name || "U")}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border"
                    />
                    <span>{p.full_name || p.nickname || "-"}</span>
                  </div>
                </td>
                <td className="p-3">{p.email}</td>
                <td className="p-3">
                  <span className="font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">⚡ {p.energy}</span>
                </td>
                <td className="p-3 text-gray-500">
                  {p.energy_reset_at ? new Date(p.energy_reset_at).toLocaleString("id-ID") : "-"}
                </td>
                <td className="p-3">
                  <Controls p={p} />
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
