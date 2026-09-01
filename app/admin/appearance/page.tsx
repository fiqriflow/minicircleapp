"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminAppearancePage() {
  const supabase = createClient();
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "default_circle_cover").maybeSingle();
      setCoverUrl(data?.value ?? null);
    };
    load();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const ext = file.name.split(".").pop();
    const path = `default-cover.${ext}`;
    const { error: uploadError } = await supabase.storage.from("circle-covers").upload(path, file, { upsert: true });

    if (uploadError) {
      alert("Gagal upload: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("circle-covers").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    setCoverUrl(url);
    setUploading(false);

    setSaving(true);
    await supabase.from("app_settings").upsert({ key: "default_circle_cover", value: url });
    setSaving(false);
  };

  const handleRemove = async () => {
    setSaving(true);
    await supabase.from("app_settings").upsert({ key: "default_circle_cover", value: null });
    setCoverUrl(null);
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-xl font-bold">Tampilan</h1>

      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <p className="text-sm font-medium">Default Cover Circle</p>
        <p className="text-xs text-gray-400">
          Dipakai otomatis untuk circle yang belum punya cover sendiri.
        </p>

        <div className="h-36 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
          {coverUrl ? (
            <img src={coverUrl} alt="default cover" className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-400 text-sm">Belum ada default cover</span>
          )}
        </div>

        <div className="flex gap-3">
          <label className="text-sm text-primary font-medium cursor-pointer">
            {uploading ? "Mengunggah..." : "Upload Cover Baru"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          {coverUrl && (
            <button onClick={handleRemove} disabled={saving} className="text-sm text-red-500 font-medium">
              Hapus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
