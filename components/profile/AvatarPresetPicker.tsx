"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAvatarPresets, type AvatarPreset } from "@/lib/avatarPresets";

export default function AvatarPresetPicker({
  selectedUrl,
  onSelect,
}: {
  selectedUrl?: string | null;
  onSelect: (url: string) => void;
}) {
  const supabase = createClient();
  const [presets, setPresets] = useState<AvatarPreset[] | null>(null);

  useEffect(() => {
    fetchAvatarPresets(supabase, true).then(({ data }) => setPresets(data));
  }, []);

  if (presets === null) return <p className="text-xs text-gray-400 text-center">Memuat avatar...</p>;
  if (presets.length === 0) return null;

  const base = (u?: string | null) => (u ? u.split("?")[0] : "");

  return (
    <div className="w-full">
      <p className="text-sm text-gray-500 mb-2 text-center">Atau pilih avatar</p>
      <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
        {presets.map((p) => {
          const active = base(selectedUrl) === base(p.image_url);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.image_url)}
              aria-label={p.name}
              aria-pressed={active}
              className={`aspect-square rounded-full overflow-hidden border-2 ${
                active ? "border-primary ring-2 ring-primary/30" : "border-transparent"
              }`}
            >
              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
