"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fetchAvatarPresets, type AvatarPreset } from "@/lib/avatarPresets";

// Saat avatar dipilih, gambarnya DISALIN ke folder foto user sendiri (avatars/{user_id}/avatar.jpg),
// sama seperti foto upload. Jadi kalau admin menghapus/mengganti preset, foto profil user tetap.
export default function AvatarPresetPicker({
  selectedUrl,
  onSelect,
}: {
  selectedUrl?: string | null;
  onSelect: (url: string) => void | Promise<void>;
}) {
  const supabase = createClient();
  const [presets, setPresets] = useState<AvatarPreset[] | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAvatarPresets(supabase, true).then(({ data }) => setPresets(data));
  }, []);

  if (presets === null) return <p className="text-xs text-gray-400 text-center">Memuat avatar...</p>;
  if (presets.length === 0) return null;

  const handlePick = async (p: AvatarPreset) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sesi login tidak ditemukan");

      const res = await fetch(p.image_url);
      if (!res.ok) throw new Error("Gambar avatar tidak bisa diambil");
      const blob = await res.blob();

      const path = `${uid}/avatar.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setPickedId(p.id);
      await onSelect(`${data.publicUrl}?t=${Date.now()}`);
    } catch (e: any) {
      toast.error("Gagal memilih avatar: " + (e?.message ?? "tidak diketahui"));
    }
    setBusy(false);
  };

  return (
    <div className="w-full">
      <p className="text-sm text-gray-500 mb-2 text-center">Atau pilih avatar</p>
      <div className={`grid grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
        {presets.map((p) => {
          const active = pickedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePick(p)}
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
