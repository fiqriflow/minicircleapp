"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, MapPin, Instagram as InstagramIcon, Cake, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import LocationInput from "@/components/LocationInput";
import AvatarCropModal from "@/components/AvatarCropModal";
import DeleteAccountModal from "@/components/DeleteAccountModal";

const CATEGORY_OPTIONS = ["Gowes", "Jalan Santai", "Jogging"];

export default function DataUserPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  const handleCropConfirm = async (blob: Blob) => {
    if (!profile?.id) return;
    setCropFile(null);
    setUploading(true);

    const path = `${profile.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) {
      alert("Gagal upload foto: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatar_url = `${data.publicUrl}?t=${Date.now()}`;

    setProfile((p: any) => ({ ...p, avatar_url }));
    await supabase.from("profiles").upsert({ ...profile, avatar_url });
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("profiles").upsert(profile);
    setSaving(false);
    setEditMode(false);
    toast.success("Profil berhasil disimpan!");
  };

  const handleDeleteAccount = async () => {
    try {
      // Hapus file avatar dulu (tidak ikut kehapus otomatis)
      const { data: files } = await supabase.storage.from("avatars").list(profile.id);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${profile.id}/${f.name}`);
        await supabase.storage.from("avatars").remove(paths);
      }

      // Hapus baris profiles -> cascade otomatis hapus circle_members & circle_comments
      // Circle yang dia host tidak ikut terhapus, created_by hanya diset null.
      const { error } = await supabase.from("profiles").delete().eq("id", profile.id);
      if (error) {
        toast.error("Gagal menghapus akun: " + error.message);
        setShowDeleteModal(false);
        return;
      }

      await supabase.auth.signOut();
      toast.success("Akun berhasil dihapus.");
      router.push("/login");
    } catch {
      toast.error("Gagal menghapus akun. Coba lagi.");
      setShowDeleteModal(false);
    }
  };

  if (!profile) return <p className="p-6 text-gray-400">Memuat...</p>;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header + back */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800" aria-label="Kembali">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-bold">Data User</h1>
        </div>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Ubah Profil"
          >
            <Pencil size={20} />
          </button>
        )}
      </div>

      {/* Section: Foto Profil */}
      <div className="flex flex-col items-center gap-2">
        <img
          src={profile.avatar_url || "https://ui-avatars.com/api/?name=" + (profile.full_name || "U")}
          alt="avatar"
          className="w-24 h-24 rounded-full object-cover border"
        />
        <label className="text-sm text-primary font-medium cursor-pointer">
          {uploading ? "Mengunggah..." : "Edit Photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCropFile(file);
              e.target.value = "";
            }}
            disabled={uploading}
          />
        </label>
      </div>

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={handleCropConfirm}
        />
      )}

      {/* Section: Detail Info User */}
      {!editMode ? (
        <div className="bg-white rounded-2xl border p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-400">Nama Lengkap</p>
            <p className="font-medium">{profile.full_name || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Nama Panggilan</p>
            <p className="font-medium">{profile.nickname || "-"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Cake size={16} className="text-gray-400" />
            <p className="text-sm">
              {profile.birth_date
                ? new Date(profile.birth_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Aktivitas Disukai</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {profile.categories?.length ? (
                profile.categories.map((c: string) => (
                  <span key={c} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">-</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-gray-400" />
            <p className="text-sm">{profile.location || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Gender</p>
            <p className="font-medium">
              {profile.gender === "male" ? "Laki-laki" : profile.gender === "female" ? "Perempuan" : "-"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InstagramIcon size={16} className="text-gray-400" />
            <p className="text-sm">{profile.instagram || "-"}</p>
          </div>
        </div>
      ) : (
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
            <label className="text-sm text-gray-500">Tanggal Lahir</label>
            <input
              type="date"
              className="w-full border rounded-xl px-4 py-2"
              value={profile.birth_date ?? ""}
              onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">Aktivitas Disukai</label>
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
            <label className="text-sm text-gray-500">Lokasi / Domisili</label>
            <LocationInput
              id="profile-city-list"
              value={profile.location ?? ""}
              onChange={(v) => setProfile({ ...profile, location: v })}
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

          <div className="flex gap-2">
            <button
              onClick={() => setEditMode(false)}
              className="flex-1 border rounded-xl py-3 font-medium text-gray-500"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-primary text-white rounded-xl py-3 font-medium hover:bg-primary-dark"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      )}

      {/* Section: Hapus Akun */}
      {!editMode && (
        <div className="pt-2">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 rounded-xl py-3 font-medium hover:bg-red-50"
          >
            <Trash2 size={18} />
            Hapus Akun
          </button>
        </div>
      )}

      {showDeleteModal && (
        <DeleteAccountModal
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  );
}
