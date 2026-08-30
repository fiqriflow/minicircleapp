"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORY_OPTIONS = ["Gowes", "Jalan Santai", "Running", "Lainnya"];

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data ?? { id: user.id });
    };
    load();
  }, []);

  const toggleCategory = (cat: string) => {
    setProfile((p: any) => {
      const current: string[] = p.categories ?? [];
      const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
      return { ...p, categories: next };
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      alert("Gagal upload foto: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    // tambahkan timestamp biar cache browser refresh
    const avatar_url = `${data.publicUrl}?t=${Date.now()}`;

    setProfile((p: any) => ({ ...p, avatar_url }));
    await supabase.from("profiles").upsert({ ...profile, avatar_url });
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("profiles").upsert(profile);
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (!profile) return <p className="p-6 text-gray-400">Memuat...</p>;

  return (
    <div className="px-4 md:px-8 py-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Profil</h1>

      {/* Foto profil */}
      <div className="flex flex-col items-center gap-2">
        <img
          src={profile.avatar_url || "https://ui-avatars.com/api/?name=" + (profile.full_name || "U")}
          alt="avatar"
          className="w-24 h-24 rounded-full object-cover border"
        />
        <label className="text-sm text-primary font-medium cursor-pointer">
          {uploading ? "Mengunggah..." : "Ganti Foto"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
            disabled={uploading}
          />
        </label>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-500">Nama Lengkap</label>
          <input
            className="w-full border rounded-xl px-4 py-2"
            value={profile.full_name ?? ""}
            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">Nama Panggilan</label>
          <input
            className="w-full border rounded-xl px-4 py-2"
            value={profile.nickname ?? ""}
            onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">Kategori Disukai</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {CATEGORY_OPTIONS.map((cat) => {
              const active = profile.categories?.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    active ? "bg-primary text-white border-primary" : "text-gray-600"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-500">Lokasi</label>
          <input
            className="w-full border rounded-xl px-4 py-2"
            value={profile.location ?? ""}
            onChange={(e) => setProfile({ ...profile, location: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">Gender</label>
          <select
            className="w-full border rounded-xl px-4 py-2"
            value={profile.gender ?? ""}
            onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
          >
            <option value="">Pilih</option>
            <option value="male">Laki-laki</option>
            <option value="female">Perempuan</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-500">Instagram</label>
          <input
            className="w-full border rounded-xl px-4 py-2"
            placeholder="@username"
            value={profile.instagram ?? ""}
            onChange={(e) => setProfile({ ...profile, instagram: e.target.value })}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary text-white rounded-xl py-3 font-medium hover:bg-primary-dark"
        >
          {saving ? "Menyimpan..." : "Simpan Profil"}
        </button>

        <button
          onClick={handleLogout}
          className="w-full border border-red-300 text-red-600 rounded-xl py-3 font-medium hover:bg-red-50"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
