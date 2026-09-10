"use client";

import { useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MAX_ENERGY, getMyEnergy, getNextResetLabel } from "@/lib/energy";

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

  const isLow = energy <= 0;

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
        {energy}/{MAX_ENERGY}
      </button>

      {showInfo && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded-xl shadow-lg z-50 p-3 text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-800">⚡ Energy</p>
          <p>Dipakai tiap kali kamu buat circle baru (-1). Reset otomatis jadi {MAX_ENERGY} setiap Senin jam 00.00.</p>
          {isLow && <p className="text-red-500 font-medium">Energy habis. Reset berikutnya: {getNextResetLabel()}.</p>}
        </div>
      )}
    </div>
  );
}
