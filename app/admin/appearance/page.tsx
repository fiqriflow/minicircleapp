"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = ["Gowes", "Jalan Santai", "Running"];

export default function AdminAppearancePage() {
  const supabase = createClient();
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<string>("");
  const [bannerUploading, setBannerUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("key,value").like("key", "default_circle_cover%");
      const map: Record<string, string> = {};
      data?.forEach((row: any) => {
        if (row.value) map[row.key] = row.value;
      });
      setCovers(map);

      const { data: bannerRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "home_banner")
        .maybeSingle();
      setBanner(bannerRow?.value || "");
    };
    load();
  }, []);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerUploading(true);

    const ext = file.name.split(".").pop();
    const path = `home-banner.${ext}`;
    const { error: uploadError } = await supabase.storage.from("circle-covers").upload(path, file, { upsert: true });

    if (uploadError) {
      alert("Gagal upload: " + uploadError.message);
      setBannerUploading(false);
      return;
    }

    const { data } = supabase.storage.from("circle-covers").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;

    await supabase.from("app_settings").upsert({ key: "home_banner", value: url });
    setBanner(url);
    setBannerUploading(false);
  };

  const handleBannerRemove = async () => {
    await supabase.from("app_settings").upsert({ key: "home_banner", value: null });
    setBanner("");
  };

  const handleUpload = async (category: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const settingKey = `default_circle_cover:${category}`;
    setUploadingKey(settingKey);

    const ext = file.name.split(".").pop();
    const path = `default-${category.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("circle-covers").upload(path, file, { upsert: true });

    if (uploadError) {
      alert("Gagal upload: " + uploadError.message);
      setUploadingKey(null);
      return;
    }

    const { data } = supabase.storage.from("circle-covers").getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;

    await supabase.from("app_settings").upsert({ key: settingKey, value: url });
    setCovers((prev) => ({ ...prev, [settingKey]: url }));
    setUploadingKey(null);
  };

  const handleRemove = async (category: string) => {
    const settingKey = `default_circle_cover:${category}`;
    await supabase.from("app_settings").upsert({ key: settingKey, value: null });
    setCovers((prev) => {
      const next = { ...prev };
      delete next[settingKey];
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Tampilan</h1>
        <p className="text-sm text-gray-400">
          Default cover per kategori — dipakai otomatis untuk circle di kategori tersebut yang belum punya cover sendiri.
        </p>
      </div>

      {/* Banner Beranda */}
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Banner Beranda</p>
          <p className="text-xs text-gray-400">Gambar hero yang tampil di paling atas halaman beranda user.</p>
        </div>

        <div className="h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
          {banner ? (
            <img src={banner} alt="Banner beranda" className="w-full h-full object-cover" />
          ) : (
            <span className="text-gray-400 text-sm">Belum ada banner</span>
          )}
        </div>

        <div className="flex gap-3">
          <label className="text-sm text-primary font-medium cursor-pointer">
            {bannerUploading ? "Mengunggah..." : "Upload"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBannerUpload}
              disabled={bannerUploading}
            />
          </label>
          {banner && (
            <button onClick={handleBannerRemove} className="text-sm text-red-500 font-medium">
              Hapus
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map((category) => {
          const settingKey = `default_circle_cover:${category}`;
          const coverUrl = covers[settingKey];
          const uploading = uploadingKey === settingKey;

          return (
            <div key={category} className="bg-white rounded-2xl border p-4 space-y-3">
              <p className="text-sm font-medium">{category}</p>

              <div className="h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                {coverUrl ? (
                  <img src={coverUrl} alt={category} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-sm">Belum ada cover</span>
                )}
              </div>

              <div className="flex gap-3">
                <label className="text-sm text-primary font-medium cursor-pointer">
                  {uploading ? "Mengunggah..." : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(category, e)}
                    disabled={uploading}
                  />
                </label>
                {coverUrl && (
                  <button onClick={() => handleRemove(category)} className="text-sm text-red-500 font-medium">
                    Hapus
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
