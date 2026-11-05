"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ENERGY_COST, NO_SHOW_PENALTY, WEEKLY_ENERGY_RESET, getMyEnergy, getNextResetLabel } from "@/lib/energy";

export default function EnergyBadge() {
  const supabase = createClient();
  const [energy, setEnergy] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const info = await getMyEnergy(supabase);
      // gagal baca -> jangan tampilkan angka default sebagai saldo asli
      if (!info.failed) setEnergy(info.energy);
    };
    load();
    // saldo diubah langsung di layar (optimistic) kalau ada delta; tanpa delta = baca ulang dari server
    const onChanged = (e: Event) => {
      const delta = (e as CustomEvent<{ delta?: number }>).detail?.delta;
      if (typeof delta === "number") {
        setEnergy((prev) => (prev === null ? prev : Math.max(0, prev + delta)));
        return;
      }
      load();
    };
    window.addEventListener("energy-changed", onChanged);
    return () => window.removeEventListener("energy-changed", onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowInfo(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (energy === null) return null;

  const isLow = energy < ENERGY_COST.join;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setShowInfo((s) => !s)}
        className={`press flex items-center gap-1 px-2.5 py-1 rounded-xl border-2 text-sm font-bold ${
          isLow ? "bg-red-50 border-red-200 text-red-500" : "bg-amber-50 border-amber-200 text-amber-500"
        }`}
        aria-label="Energy"
      >
        <Zap size={16} fill="currentColor" />
        {energy}
      </button>

      {showInfo && (
        <div className="absolute right-0 mt-2 w-64 bg-white border rounded-xl shadow-lg z-50 p-3 text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-800">⚡ Energy</p>
          <p>Saldo energy kamu dipakai untuk:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Join circle: -{ENERGY_COST.join}</li>
            <li>Buat circle: -{ENERGY_COST.create}</li>
            <li>Buat circle plus: -{ENERGY_COST.createPlus}</li>
            <li>Pelanggaran (tidak check-in): -{NO_SHOW_PENALTY}</li>
          </ul>
          <p>
            Energy di-reset jadi {WEEKLY_ENERGY_RESET} tiap Senin 00.00 WIB (berikutnya {getNextResetLabel()}). Sisa energy minggu lalu tidak dibawa.
          </p>
          <Link href="/profile/energi" onClick={() => setShowInfo(false)} className="inline-block font-semibold text-primary">
            Lihat rincian
          </Link>
          {isLow && (
            <p className="text-red-500 font-medium">Energy habis. Hubungi admin untuk menambah energy.</p>
          )}
        </div>
      )}
    </div>
  );
}
