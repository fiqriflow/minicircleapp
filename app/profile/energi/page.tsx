"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DAILY_ENERGY_BONUS, ENERGY_COST, getMyEnergy, getNextBonusLabel } from "@/lib/energy";

type Row = { id: number; delta: number; balance: number; reason: string; created_at: string };

const PAGE_SIZE = 30;
// pencatatan awal tidak dihitung sebagai "didapat/terpakai"
const NEUTRAL = new Set(["opening", "initial"]);

const REASON_LABEL: Record<string, string> = {
  opening: "Saldo awal pencatatan",
  initial: "Saldo awal akun",
  daily_bonus: "Bonus harian",
  join_circle: "Join circle",
  create_circle: "Membuat circle",
  create_circle_plus: "Membuat circle plus",
  admin_adjust: "Penyesuaian oleh admin",
  no_show: "Penalti tidak check-in",
  host_correction: "Koreksi kehadiran oleh host",
  other: "Penyesuaian energi",
};

function labelOf(r: Row) {
  if (r.reason === "daily_bonus" && r.delta > DAILY_ENERGY_BONUS) {
    return `Bonus harian (${Math.round(r.delta / DAILY_ENERGY_BONUS)} hari)`;
  }
  return REASON_LABEL[r.reason] ?? "Penyesuaian energi";
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

// awal bulan ini (WIB, UTC+7 tetap) dalam ISO UTC
function monthStartIso() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - 7 * 60 * 60 * 1000).toISOString();
}

export default function EnergiPage() {
  const supabase = createClient();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState<{ gained: number; used: number } | null>(null);

  const fetchPage = useCallback(
    async (beforeId?: number) => {
      let q = supabase
        .from("energy_ledger")
        .select("id, delta, balance, reason, created_at")
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);
      if (beforeId) q = q.lt("id", beforeId);
      return q;
    },
    [supabase]
  );

  useEffect(() => {
    (async () => {
      const info = await getMyEnergy(supabase); // sekalian hitung bonus harian tertunda
      if (!info.failed) setBalance(info.energy);

      const [{ data, error: err }, { data: mdata }] = await Promise.all([
        fetchPage(),
        supabase
          .from("energy_ledger")
          .select("delta, reason")
          .gte("created_at", monthStartIso())
          .limit(1000),
      ]);
      if (err) setError(err.message);
      const list = (data ?? []) as Row[];
      setRows(list);
      setHasMore(list.length === PAGE_SIZE);

      let gained = 0;
      let used = 0;
      for (const m of (mdata ?? []) as { delta: number; reason: string }[]) {
        if (NEUTRAL.has(m.reason)) continue;
        if (m.delta > 0) gained += m.delta;
        else used += -m.delta;
      }
      setMonth({ gained, used });
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    if (loadingMore || rows.length === 0) return;
    setLoadingMore(true);
    const { data } = await fetchPage(rows[rows.length - 1].id);
    const list = (data ?? []) as Row[];
    setRows((prev) => [...prev, ...list]);
    setHasMore(list.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  return (
    <div className="px-4 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Kembali" className="p-1 -ml-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Rincian Energi</h1>
      </div>

      {/* Saldo */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-yellow-600">
          <Zap size={20} fill="currentColor" />
          <span className="text-3xl font-bold">{balance ?? "-"}</span>
          <span className="text-sm">energi saat ini</span>
        </div>
        {month && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-xl border px-3 py-2">
              <p className="text-xs text-gray-400">Didapat bulan ini</p>
              <p className="font-semibold text-green-600">+{month.gained}</p>
            </div>
            <div className="bg-white rounded-xl border px-3 py-2">
              <p className="text-xs text-gray-400">Terpakai bulan ini</p>
              <p className="font-semibold text-red-500">-{month.used}</p>
            </div>
          </div>
        )}
      </div>

      {/* Aturan */}
      <div className="bg-white border rounded-2xl p-4 text-sm text-gray-600 space-y-1">
        <p className="font-semibold text-gray-800">Penggunaan energi</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>Join circle: -{ENERGY_COST.join}</li>
          <li>Buat circle: -{ENERGY_COST.create}</li>
          <li>Buat circle plus: -{ENERGY_COST.createPlus}</li>
          <li>Tidak check-in di circle yang diikuti: -1</li>
          <li>
            Bonus +{DAILY_ENERGY_BONUS} tiap hari 00.00 WIB, menumpuk (berikutnya {getNextBonusLabel()})
          </li>
        </ul>
      </div>

      {/* Riwayat */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase px-1">Riwayat</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Memuat...</p>
        ) : error ? (
          <p className="text-red-500 text-sm">Gagal memuat riwayat: {error}</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 text-sm">Belum ada riwayat energi.</p>
        ) : (
          <div className="bg-white rounded-2xl border divide-y overflow-hidden">
            {rows.map((r) => {
              const neutral = NEUTRAL.has(r.reason);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{labelOf(r)}</p>
                    <p className="text-xs text-gray-400">{fmtDate(r.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-semibold ${
                        neutral ? "text-gray-500" : r.delta > 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {neutral ? r.balance : r.delta > 0 ? `+${r.delta}` : r.delta}
                    </p>
                    {!neutral && <p className="text-xs text-gray-400">sisa {r.balance}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full border rounded-xl py-2 text-sm text-gray-600 disabled:opacity-50"
          >
            {loadingMore ? "Memuat..." : "Muat lebih banyak"}
          </button>
        )}
      </div>
    </div>
  );
}
