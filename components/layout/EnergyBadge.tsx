"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ENERGY_COST, DAILY_ENERGY_BONUS, getMyEnergy, getNextBonusLabel } from "@/lib/energy";

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
      setEnergy(info.energy);
    };
    load();
    // saldo dibaca ulang setelah join / buat circle
    window.addEventListener("energy-changed", load);
    return () => window.removeEventListener("energy-changed", load);
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
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
          isLow ? "bg-red-50 text-red-500" : "bg-yellow-50 text-yellow-600"
        }`}
        aria-label="Energy"
      >
        <Zap size={14} fill="currentColor" />
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
          </ul>
          <p>
            Bonus +{DAILY_ENERGY_BONUS} energy tiap hari 00.00 (berikutnya {getNextBonusLabel()}), dan menumpuk.
          </p>
          {isLow && (
            <p className="text-red-500 font-medium">Energy habis. Hubungi admin untuk menambah energy.</p>
          )}
        </div>
      )}
    </div>
  );
}
