"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import LocationInput from "@/components/ui/LocationInput";
import AvatarCropModal from "@/components/profile/AvatarCropModal";
import DeleteAccountModal from "@/components/profile/DeleteAccountModal";
import AvatarPresetPicker from "@/components/profile/AvatarPresetPicker";
import { saveProfile } from "@/lib/profile";

const CATEGORY_OPTIONS = ["Gowes", "Jalan Santai", "Jogging", "Kulineran", "Ngopi", "Explore Alam"];

function getMissingOptionalFields(profile: any) {
  const missing: string[] = [];
  if (!profile?.avatar_url) missing.push("Foto Profil");
  if (!profile?.instagram) missing.push("Instagram");
  return missing;
}

// Harus sama dengan validasi di DB (migration 0050)
const IG_REGEX = /^@[A-Za-z0-9._]{1,30}$/;

// Tanggal lahir hanya bisa diisi sekali (DB). Batas yang sama dengan onboarding + trigger DB (migration 0055).
const MIN_AGE = 17;
const MIN_BIRTH_DATE = "1920-01-01";
function localDateStr(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function maxBirthDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE);
  return localDateStr(d);
}
function isValidBirthDate(v?: string | null) {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= MIN_BIRTH_DATE && v <= maxBirthDate();
}

export default function DataUserPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // gender & tanggal lahir hanya boleh diisi sekali (dikunci di DB, migration 0050)
  const [locked, setLocked] = useState({ gender: false, birth: false });
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc("get_my_profile").maybeSingle();
      setProfile(data ?? { id: user.id });
      setLocked({ gender: !!(data as any)?.gender, birth: !!(data as any)?.birth_date });
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
      .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" });

    if (uploadError) {
      toast.error("Gagal upload foto: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatar_url = `${data.publicUrl}?t=${Date.now()}`;

    // hanya kolom foto: perubahan form lain yang belum disimpan (mode edit) jangan ikut tersimpan diam-diam
    const { error: saveError } = await saveProfile(supabase, { id: profile.id, avatar_url });
    setUploading(false);
    if (saveError) {
      toast.error("Gagal menyimpan foto: " + saveError.message);
      return;
    }
    setProfile((p: any) => ({ ...p, avatar_url }));
    toast.success("Foto profil diperbarui!");
  };

  const handlePickPreset = async (url: string) => {
    if (!profile?.id || uploading) return;
    setUploading(true);
    const { error } = await saveProfile(supabase, { id: profile.id, avatar_url: url });
    setUploading(false);
    if (error) {
      toast.error("Gagal menyimpan avatar: " + error.message);
      return;
    }
    setProfile((p: any) => ({ ...p, avatar_url: url }));
    setShowPresets(false);
    toast.success("Avatar diperbarui!");
  };

  const handleSave = async () => {
    if (!profile.full_name?.trim() || !profile.nickname?.trim()) {
      toast.error("Nama lengkap dan nama panggilan wajib diisi.");
      return;
    }
    if (!locked.birth && profile.birth_date && !isValidBirthDate(profile.birth_date)) {
      toast.error(`Tanggal lahir tidak valid. Mincle khusus pengguna berusia minimal ${MIN_AGE} tahun.`);
      return;
    }
    if (!profile.instagram || !IG_REGEX.test(profile.instagram)) {
      toast.error("Instagram wajib diisi dengan format @username (huruf, angka, titik, underscore; maks 30).");
      return;
    }
    if (!profile.avatar_url) {
      toast.error("Foto profil wajib diisi.");
      return;
    }
    setSaving(true);
    const payload = { ...profile, full_name: profile.full_name.trim(), nickname: profile.nickname.trim() };
    const { error } = await saveProfile(supabase, payload);
    setSaving(false);
    if (error) {
      toast.error("Gagal menyimpan profil: " + error.message);
      return;
    }
    setProfile(payload);
    setLocked({ gender: !!profile.gender, birth: !!profile.birth_date });
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

  const missingFields = getMissingOptionalFields(profile);

  return (
    <div>
      {/* Header + back — sticky biar tombol back kejangkau pas scroll */}
      <div className="sticky top-0 z-10 bg-white border-b flex items-center justify-between px-4 py-3">
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

      <div className="px-4 py-6 space-y-6">
      {!editMode && missingFields.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">
          <Info size={18} className="shrink-0 mt-0.5" />
          <p>
            Lengkapi profil kamu: <span className="font-medium">{missingFields.join(", ")}</span> belum diisi.
          </p>
        </div>
      )}

      {/* Section: Foto Profil */}
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
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCropFile(file);
              e.target.value = "";
            }}
            disabled={uploading}
          />
        </label>
        <button
          type="button"
          onClick={() => setShowPresets((v) => !v)}
          disabled={uploading}
          className="text-sm text-primary font-medium"
        >
          {showPresets ? "Tutup Pilihan Avatar" : "Pilih Avatar"}
        </button>
        {showPresets && (
          <AvatarPresetPicker selectedUrl={profile.avatar_url} onSelect={handlePickPreset} />
        )}
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
        <>
          <div className="bg-white rounded-2xl border p-4 space-y-4">
            <div>
              <p className="text-sm text-gray-400">Nama Lengkap</p>
              <p className="font-semibold text-lg">{profile.full_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Nama Panggilan</p>
              <p className="font-semibold text-lg">{profile.nickname || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Tanggal Lahir</p>
              <p className="font-semibold text-lg">
                {profile.birth_date
                  ? new Date(profile.birth_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Kota/Domisili</p>
              <p className="font-semibold text-lg">{profile.location || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Gender</p>
              <p className="font-semibold text-lg">
                {profile.gender === "male" ? "Pria" : profile.gender === "female" ? "Wanita" : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Akun Instagram</p>
              <p className="font-semibold text-lg">{profile.instagram || "-"}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-4">
            <p className="text-sm text-gray-400 mb-2">Aktivitas Disukai</p>
            <div className="flex flex-wrap gap-2">
              {profile.categories?.length ? (
                profile.categories.map((c: string) => (
                  <span key={c} className="text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium">
                    {c}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">-</span>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500">Nama Lengkap</label>
            <input
              className="w-full border rounded-xl px-4 py-2"
              maxLength={100}
              value={profile.full_name ?? ""}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">Nama Panggilan</label>
            <input
              className="w-full border rounded-xl px-4 py-2"
              maxLength={50}
              value={profile.nickname ?? ""}
              onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">Tanggal Lahir</label>
            <input
              type="date"
              min={MIN_BIRTH_DATE}
              max={maxBirthDate()}
              className="w-full border rounded-xl px-4 py-2"
              value={profile.birth_date ?? ""}
              disabled={locked.birth}
              onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
            />
            {locked.birth && (
              <p className="text-xs text-gray-400 mt-1">Tidak bisa diubah. Hubungi admin kalau salah input.</p>
            )}
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
              disabled={locked.gender}
              onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
            >
              <option value="">Pilih</option>
              <option value="male">Pria</option>
              <option value="female">Wanita</option>
            </select>
            {locked.gender && (
              <p className="text-xs text-gray-400 mt-1">Tidak bisa diubah. Hubungi admin kalau salah input.</p>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-500">Instagram (wajib)</label>
            <input
              className="w-full border rounded-xl px-4 py-2"
              placeholder="@username"
              value={profile.instagram ?? ""}
              onChange={(e) => {
                // spasi dibuang, "@" otomatis ditambah kalau lupa (DB juga menormalkan)
                const v = e.target.value.replace(/\s/g, "");
                setProfile({ ...profile, instagram: v && !v.startsWith("@") ? "@" + v : v });
              }}
            />
            {profile.instagram && !IG_REGEX.test(profile.instagram) && (
              <p className="text-xs text-red-500 mt-1">Format: @username (huruf, angka, titik, underscore; maks 30)</p>
            )}
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
    </div>
  );
}
