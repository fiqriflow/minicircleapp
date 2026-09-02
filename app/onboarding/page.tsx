"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LocationInput from "@/components/LocationInput";
import AvatarCropModal from "@/components/AvatarCropModal";

const CATEGORY_OPTIONS = ["Gowes", "Jalan Santai", "Running"];
const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
    setUploadingAvatar(true);

    const path = `${profile.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) {
      alert("Gagal upload foto: " + uploadError.message);
      setUploadingAvatar(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setProfile((p: any) => ({ ...p, avatar_url: `${data.publicUrl}?t=${Date.now()}` }));
    setUploadingAvatar(false);
  };

  const canProceed = () => {
    if (step === 0) return !!profile?.full_name && !!profile?.nickname;
    if (step === 1) return (profile?.categories?.length ?? 0) > 0 && !!profile?.location;
    return true; // step 2 & 3 opsional
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    await supabase.from("profiles").upsert({ ...profile, onboarding_completed: true });
    setSaving(false);
    router.push("/");
    router.refresh();
  };

  if (!profile) return <p className="p-6 text-gray-400 text-center">Memuat...</p>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Progress bar */}
        <div className="flex gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-gray-200"}`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl border p-6 space-y-5">
          {step === 0 && (
            <>
              <div>
                <h2 className="text-lg font-bold">Kenalan dulu yuk 👋</h2>
                <p className="text-sm text-gray-500">Lengkapi nama kamu.</p>
              </div>
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
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2 className="text-lg font-bold">Aktivitas & Domisili</h2>
                <p className="text-sm text-gray-500">Biar circle yang muncul makin relevan.</p>
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
                <label className="text-sm text-gray-500">Lokasi / Domisili</label>
                <LocationInput
                  id="onboarding-city-list"
                  value={profile.location ?? ""}
                  onChange={(v) => setProfile({ ...profile, location: v })}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-lg font-bold">Detail Tambahan</h2>
                <p className="text-sm text-gray-500">Opsional, tapi biar profil kamu makin lengkap.</p>
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
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="text-lg font-bold">Terakhir nih ✨</h2>
                <p className="text-sm text-gray-500">Foto profil & Instagram (opsional).</p>
              </div>

              <div className="flex flex-col items-center gap-2">
                <img
                  src={profile.avatar_url || "https://ui-avatars.com/api/?name=" + (profile.full_name || "U")}
                  alt="avatar"
                  className="w-20 h-20 rounded-full object-cover border"
                />
                <label className="text-sm text-primary font-medium cursor-pointer">
                  {uploadingAvatar ? "Mengunggah..." : "Pilih Foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCropFile(file);
                      e.target.value = "";
                    }}
                    disabled={uploadingAvatar}
                  />
                </label>
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
            </>
          )}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={handleBack} className="flex-1 border rounded-xl py-3 font-medium text-gray-500">
              Kembali
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 bg-primary text-white rounded-xl py-3 font-medium disabled:opacity-40"
            >
              Lanjut
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex-1 bg-primary text-white rounded-xl py-3 font-medium"
            >
              {saving ? "Menyimpan..." : "Selesai"}
            </button>
          )}
        </div>
      </div>

      {cropFile && (
        <AvatarCropModal file={cropFile} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} />
      )}
    </div>
  );
}
