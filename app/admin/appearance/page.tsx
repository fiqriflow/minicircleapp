"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { extractStoragePath } from "@/lib/storagePath";

const CATEGORIES = ["Gowes", "Jalan Santai", "Jogging"];

export default function AdminAppearancePage() {
  const supabase = createClient();
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [banner, setBanner] = useState<string>("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

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
    const oldPath = extractStoragePath(banner, "circle-covers");

    const { error: settingError } = await supabase.from("app_settings").upsert({ key: "home_banner", value: url });
    if (settingError) {
      alert("Gagal simpan setting banner: " + settingError.message);
      setBannerUploading(false);
      return;
    }
    setBanner(url);
    setImgErrors((prev) => ({ ...prev, home_banner: false }));
    setBannerUploading(false);
    toast.success("Banner beranda berhasil diperbarui!");
    if (oldPath && oldPath !== path) {
      await supabase.storage.from("circle-covers").remove([oldPath]);
    }
  };

  const handleBannerRemove = async () => {
    const { error } = await supabase.from("app_settings").upsert({ key: "home_banner", value: null });
    if (error) {
      toast.error("Gagal hapus banner: " + error.message);
      return;
    }
    const oldPath = extractStoragePath(banner, "circle-covers");
    setBanner("");
    toast.success("Banner beranda berhasil dihapus.");
    if (oldPath) {
      await supabase.storage.from("circle-covers").remove([oldPath]);
    }
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
    const oldPath = extractStoragePath(covers[settingKey], "circle-covers");

    const { error: settingError } = await supabase.from("app_settings").upsert({ key: settingKey, value: url });
    if (settingError) {
      alert("Gagal simpan setting cover: " + settingError.message);
      setUploadingKey(null);
      return;
    }
    setCovers((prev) => ({ ...prev, [settingKey]: url }));
    setImgErrors((prev) => ({ ...prev, [settingKey]: false }));
    setUploadingKey(null);
    toast.success(`Cover kategori ${category} berhasil diperbarui!`);
    if (oldPath && oldPath !== path) {
      await supabase.storage.from("circle-covers").remove([oldPath]);
    }
  };

  const handleRemove = async (category: string) => {
    const settingKey = `default_circle_cover:${category}`;
    const { error } = await supabase.from("app_settings").upsert({ key: settingKey, value: null });
    if (error) {
      toast.error("Gagal hapus cover: " + error.message);
      return;
    }
    const oldPath = extractStoragePath(covers[settingKey], "circle-covers");
    setCovers((prev) => {
      const next = { ...prev };
      delete next[settingKey];
      return next;
    });
    toast.success(`Cover kategori ${category} berhasil dihapus.`);
    if (oldPath) {
      await supabase.storage.from("circle-covers").remove([oldPath]);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Tampilan</h1>
        <p className="text-sm text-gray-400">
          Default cover per kategori — dipakai otomatis untuk circle di kategori tersebut yang belum punya cover sendiri.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Ukuran ideal cover: <span className="font-medium text-gray-500">800 x 450 px</span> (rasio 16:9), format JPG/PNG, maks 1MB.
        </p>
      </div>

      {/* Banner Beranda */}
      <div className="bg-white rounded-2xl border p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">Banner Beranda</p>
          <p className="text-xs text-gray-400">Gambar hero yang tampil di paling atas halaman beranda user.</p>
          <p className="text-xs text-gray-400 mt-1">
            Ukuran ideal: <span className="font-medium text-gray-500">1200 x 400 px</span> (rasio 3:1), format JPG/PNG, maks 1MB.
          </p>
        </div>

        <div className="h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
          {banner && !imgErrors.home_banner ? (
            <img
              src={banner}
              alt="Banner beranda"
              className="w-full h-full object-cover"
              onError={() => setImgErrors((prev) => ({ ...prev, home_banner: true }))}
            />
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
                {coverUrl && !imgErrors[settingKey] ? (
                  <img
                    src={coverUrl}
                    alt={category}
                    className="w-full h-full object-cover"
                    onError={() => setImgErrors((prev) => ({ ...prev, [settingKey]: true }))}
                  />
                ) : (
                  <span className="text-gray-400 text-sm">Cover belum diatur</span>
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
