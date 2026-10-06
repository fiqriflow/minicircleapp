"use client";

import { useEffect, useRef, useState } from "react";
import { GENERATIONS, generationKey } from "@/lib/joinFilters";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X } from "lucide-react";
import { generateInviteCode } from "@/lib/inviteCode";
import { extractStoragePath } from "@/lib/storagePath";
import { compressImage, LONG_CACHE } from "@/lib/imageCompress";
import { toDateValue, toTimeValue, combineDateTime } from "@/lib/dateTimeLocal";
import LocationInput from "@/components/ui/LocationInput";
import { ENERGY_COST, getMyEnergy, mapEnergyError, notifyEnergyChanged } from "@/lib/energy";

const CATEGORY_OPTIONS = ["Jogging", "Jalan Santai", "Gowes", "Kulineran", "Ngopi", "Explore Alam"];

export default function CreateCircleModal({
  circleType,
  editCircle,
  templateCircle,
  onClose,
  onCreated,
}: {
  circleType?: "regular" | "plus";
  editCircle?: any;
  templateCircle?: any; // salin circle lama sebagai template (mode buat baru, tanggal dikosongkan)
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const isEdit = !!editCircle;
  const isPlus = isEdit ? !!editCircle.is_circle_plus : circleType === "plus";
  const minP = 3;
  // Circle maks 7 orang, Circle+ maks 32 orang. Circle lama yang slotnya lebih besar tetap boleh diedit.
  const slotLimit = isPlus ? 32 : 7;
  const maxP = isEdit ? Math.max(slotLimit, editCircle.max_participants ?? 0) : slotLimit;

  const [form, setForm] = useState(() =>
    isEdit
      ? {
          name: editCircle.name ?? "",
          group_name: editCircle.group_name ?? "",
          max_participants: editCircle.max_participants ?? (isPlus ? 8 : 5),
          category: editCircle.category ?? "",
          city: editCircle.city ?? "",
          location: editCircle.location ?? "",
          event_day: toDateValue(editCircle.event_date),
          start_time: toTimeValue(editCircle.event_date),
          description: editCircle.description ?? "",
          cover_url: editCircle.cover_url ?? "",
          is_private: editCircle.is_private ?? false,
          invite_code: editCircle.invite_code ?? "",
          join_question: editCircle.join_question ?? "",
          requires_approval: editCircle.requires_approval ?? false,
          join_gender: editCircle.join_gender ?? "",
          join_birth_year_min: editCircle.join_birth_year_min ?? null,
          join_birth_year_max: editCircle.join_birth_year_max ?? null,
          join_verified_only: editCircle.join_verified_only ?? false,
        }
      : templateCircle
      ? {
          name: templateCircle.name ?? "",
          group_name: templateCircle.group_name ?? "",
          max_participants: Math.min(templateCircle.max_participants ?? 5, slotLimit),
          category: templateCircle.category ?? "",
          city: templateCircle.city ?? "",
          location: templateCircle.location ?? "",
          event_day: "",
          start_time: "",
          description: templateCircle.description ?? "",
          cover_url: "", // file cover disalin di effect bawah (jangan pakai URL yang sama)
          is_private: templateCircle.is_private ?? false,
          invite_code: "",
          join_question: templateCircle.requires_approval ? templateCircle.join_question ?? "" : "",
          requires_approval: templateCircle.requires_approval ?? false,
          join_gender: templateCircle.join_gender ?? "",
          join_birth_year_min: templateCircle.join_birth_year_min ?? null,
          join_birth_year_max: templateCircle.join_birth_year_max ?? null,
          join_verified_only: templateCircle.join_verified_only ?? false,
        }
      : {
          name: "",
          group_name: "",
          max_participants: isPlus ? 8 : 5,
          category: "",
          city: "",
          location: "",
          event_day: "",
          start_time: "",
          description: "",
          cover_url: "",
          is_private: false,
          invite_code: "",
          join_question: "",
          requires_approval: false,
          join_gender: "",
          join_birth_year_min: null,
          join_birth_year_max: null,
          join_verified_only: false,
        }
  );
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [host, setHost] = useState<any>(null);
  const [hostChecked, setHostChecked] = useState(false);
  const [energy, setEnergy] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const missingInstagram = !isEdit && hostChecked && !host?.instagram;
  const missingAvatar = !isEdit && hostChecked && !host?.avatar_url;
  const createCost = isPlus ? ENERGY_COST.createPlus : ENERGY_COST.create;
  const noEnergy = !isEdit && energy !== null && energy < createCost;
  const profileIncomplete = missingInstagram || missingAvatar || noEnergy;

  // Di HP, pas keyboard muncul, browser ngecilin "visual viewport" tapi elemen
  // position:fixed tetap ngikutin ukuran layar penuh -> sheet ini jadi ketutupan
  // keyboard. Dengerin visualViewport biar tingginya ikut nyesuain.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => setViewportHeight(vv.height);
    handleResize();
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  // Auto-scroll input yang lagi difokus biar keliatan di atas keyboard.
  const handleFieldFocus = (e: React.FocusEvent<HTMLElement>) => {
    const target = e.target;
    setTimeout(() => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
  };

  useEffect(() => {
    const loadHost = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, nickname, avatar_url, instagram").eq("id", user.id).single();
      setHost(data);
      setHostChecked(true);
      if (!isEdit) {
        const info = await getMyEnergy(supabase);
        setEnergy(info.energy);
      }
    };
    loadHost();
  }, []);

  // Duplikat: salin FILE cover (bukan pakai URL yang sama), supaya hapus/ganti cover di circle lama
  // tidak merusak circle baru, dan batal di sini tidak menghapus cover circle lama.
  const coverCopied = useRef(false);
  useEffect(() => {
    if (isEdit || !isPlus || !templateCircle?.cover_url || coverCopied.current) return;
    coverCopied.current = true;
    (async () => {
      const src = extractStoragePath(templateCircle.cover_url, "circle-covers");
      if (!src) return;
      setUploadingCover(true);
      const ext = src.split(".").pop() || "jpg";
      const dest = `${Date.now()}.${ext}`;
      const { error: copyError } = await supabase.storage.from("circle-covers").copy(src, dest);
      if (!copyError) {
        const { data } = supabase.storage.from("circle-covers").getPublicUrl(dest);
        setForm((f) => ({ ...f, cover_url: data.publicUrl }));
      }
      setUploadingCover(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    let up;
    try {
      up = await compressImage(file, { maxSize: 1280, quality: 0.8 });
    } catch {
      alert("Gagal memproses gambar");
      setUploadingCover(false);
      return;
    }
    const path = `${Date.now()}.${up.ext}`;
    const { error: uploadError } = await supabase.storage
      .from("circle-covers")
      .upload(path, up.blob, { upsert: true, contentType: up.contentType, cacheControl: LONG_CACHE });
    if (uploadError) {
      alert("Gagal upload cover: " + uploadError.message);
      setUploadingCover(false);
      return;
    }
    const { data } = supabase.storage.from("circle-covers").getPublicUrl(path);
    const oldPath = extractStoragePath(form.cover_url, "circle-covers");
    setForm((f) => ({ ...f, cover_url: data.publicUrl }));
    setCoverError(false);
    setUploadingCover(false);
    if (oldPath && oldPath !== path) {
      await supabase.storage.from("circle-covers").remove([oldPath]);
    }
  };

  // Hapus cover: kosongkan -> saat disimpan otomatis pakai cover default sesuai aktivitas.
  // File yang baru diupload sesi ini langsung dihapus; cover asli dihapus dari storage setelah Simpan berhasil.
  const handleRemoveCover = async () => {
    const originalCoverUrl = editCircle?.cover_url ?? "";
    if (form.cover_url && form.cover_url !== originalCoverUrl) {
      const path = extractStoragePath(form.cover_url, "circle-covers");
      if (path) await supabase.storage.from("circle-covers").remove([path]);
    }
    setForm((f) => ({ ...f, cover_url: "" }));
    setCoverError(false);
  };

  const handleSave = async () => {
    if (missingInstagram || missingAvatar) {
      setError("Lengkapi foto profil (wajah jelas) & Instagram dulu.");
      return;
    }
    if (noEnergy) {
      setError(`Energy tidak cukup (butuh ${createCost}, sisa ${energy}). Hubungi admin untuk menambah energy.`);
      return;
    }
    const requiredFields: { key: string; label: string; ok: boolean }[] = [
      { key: "name", label: "Nama Event", ok: !!form.name.trim() },
      { key: "category", label: "Aktivitas Circle", ok: !!form.category },
      { key: "city", label: "Lokasi / Domisili", ok: !!form.city.trim() },
      { key: "location", label: "Titik Kumpul", ok: !!form.location.trim() },
      { key: "event_date", label: "Tanggal", ok: !!form.event_day },
      { key: "start_time", label: "Jam Mulai", ok: !!form.start_time },
      { key: "description", label: "Rundown / Detail Kegiatan", ok: !!form.description.trim() },
    ];
    const missing = requiredFields.filter((f) => !f.ok);
    if (missing.length) {
      const errs: Record<string, boolean> = {};
      missing.forEach((f) => (errs[f.key] = true));
      setFieldErrors(errs);
      toast.error(`Lengkapi dulu "${missing[0].label}" (ditandai merah).`);
      fieldRefs.current[missing[0].key]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setFieldErrors({});
    const startIso = combineDateTime(form.event_day, form.start_time);
    if (!startIso) {
      setError("Tanggal & jam tidak valid.");
      return;
    }
    if (!isEdit && new Date(startIso) < new Date()) {
      setFieldErrors({ start_time: true });
      setError("Tanggal & jam mulai tidak boleh yang sudah lewat. Pilih waktu di masa depan.");
      return;
    }
    // kode undangan buatan sendiri: min 6 karakter, hanya A-Z 0-9 - _ (aman dipakai di URL)
    const customCode = form.invite_code.trim().toUpperCase();
    if (isPlus && customCode && customCode !== (editCircle?.invite_code ?? "").toUpperCase()) {
      if (customCode.length < 6) {
        setError("Kode undangan minimal 6 karakter biar tidak mudah ditebak.");
        return;
      }
      if (!/^[A-Z0-9_-]+$/.test(customCode)) {
        setError("Kode undangan hanya boleh huruf, angka, tanda - dan _.");
        return;
      }
    }
    setSaving(true);
    setError("");

    const payload: any = {
      name: form.name,
      group_name: form.group_name.trim() || null,
      max_participants: form.max_participants,
      category: form.category,
      city: form.city,
      location: form.location,
      event_date: startIso,
      description: form.description,
    };

    if (isPlus) {
      payload.cover_url = form.cover_url || null;
      payload.is_private = form.is_private;
      payload.invite_code = (form.invite_code.trim() || generateInviteCode()).toUpperCase();
      // pertanyaan join hanya berlaku kalau approval aktif (dijaga juga di DB, migration 0043)
      payload.requires_approval = form.requires_approval;
      // filter peserta (juga dijaga di DB, migration 0047)
      payload.join_gender = form.join_gender || null;
      payload.join_birth_year_min = form.join_birth_year_min;
      payload.join_birth_year_max = form.join_birth_year_max;
      payload.join_verified_only = form.join_verified_only;
      payload.join_question = form.requires_approval ? form.join_question.trim().slice(0, 200) || null : null;
    }

    if (isEdit) {
      const { error: updateError } = await supabase.from("circles").update(payload).eq("id", editCircle.id);
      setSaving(false);
      if (updateError) {
        setError(
          updateError.message.includes("duplicate")
            ? "Kode undangan sudah dipakai, coba kode lain."
            : updateError.message
        );
        return;
      }
      // cover asli sudah diganti/dihapus -> bersihkan file lamanya
      const originalCover = editCircle?.cover_url ?? "";
      if (isPlus && originalCover && form.cover_url !== originalCover) {
        const oldPath = extractStoragePath(originalCover, "circle-covers");
        if (oldPath) await supabase.storage.from("circle-covers").remove([oldPath]);
      }
      toast.success("Perubahan circle berhasil disimpan!");
      onCreated();
      onClose();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    payload.status = "active";
    payload.created_by = user?.id;
    payload.is_circle_plus = isPlus;

    const { data: newCircle, error: insertError } = await supabase
      .from("circles")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setSaving(false);
      const energyMsg = mapEnergyError(insertError.message);
      setError(
        energyMsg
          ? energyMsg
          : insertError.message.includes("duplicate")
          ? "Kode undangan sudah dipakai, coba kode lain."
          : insertError.message
      );
      if (energyMsg) notifyEnergyChanged();
      return;
    }

    // host otomatis masuk line up
    if (newCircle && user) {
      await supabase.from("circle_members").insert({
        circle_id: newCircle.id,
        user_id: user.id,
        status: "joined",
      });
    }

    setSaving(false);
    notifyEnergyChanged();
    onCreated();
    onClose();
  };

  const handleCancel = async () => {
    const originalCoverUrl = editCircle?.cover_url ?? "";
    if (form.cover_url && form.cover_url !== originalCoverUrl) {
      const path = extractStoragePath(form.cover_url, "circle-covers");
      if (path) {
        await supabase.storage.from("circle-covers").remove([path]);
      }
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-x-0 top-0 bg-black/40 flex items-end justify-center z-50"
      style={{ height: viewportHeight ? `${viewportHeight}px` : "100vh" }}
    >
      <div className="bg-white rounded-t-2xl w-full max-w-md max-h-[90%] flex flex-col overflow-hidden">
        <div className="shrink-0 bg-white border-b px-6 pt-5 pb-3 flex items-center justify-between">
          <h2 className="font-bold text-lg">
            {isEdit ? "Edit Circle" : `Buat ${isPlus ? "Circle+" : "Circle"} Baru`}
            {!isEdit && templateCircle && (
              <span className="block text-xs font-normal text-gray-400">Salinan dari "{templateCircle.name}" — isi tanggal & jam baru</span>
            )}
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Tutup"
            className="p-1.5 -mr-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-6 pt-4 space-y-3" onFocusCapture={handleFieldFocus}>
        {profileIncomplete ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Lengkapi profil dulu sebelum buat circle:
            </p>
            <ul className="text-sm space-y-1">
              {missingAvatar && (
                <li className="flex items-center gap-2 text-red-500">
                  ⚠️ Foto profil (wajah jelas)
                </li>
              )}
              {missingInstagram && (
                <li className="flex items-center gap-2 text-red-500">
                  ⚠️ Username Instagram
                </li>
              )}
              {noEnergy && (
                <li className="flex items-center gap-2 text-red-500">
                  ⚡ Energy tidak cukup (butuh {createCost}, sisa {energy}). Hubungi admin untuk menambah energy.
                </li>
              )}
            </ul>
            {(missingAvatar || missingInstagram) && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-700">
                  💡 Pakai foto & IG asli biar calon member percaya sama circle-mu.
                </p>
              </div>
            )}
            {(missingAvatar || missingInstagram) && (
              <a
                href="/profile/data-user"
                className="block text-center bg-primary text-white rounded-xl py-3 font-medium"
              >
                Lengkapi Profil
              </a>
            )}
            <button onClick={onClose} className="w-full py-2 text-gray-500 text-sm">
              {noEnergy && !missingAvatar && !missingInstagram ? "Oke, mengerti" : "Nanti dulu"}
            </button>
          </div>
        ) : (
        <>

        {host && !isEdit && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
            <img
              src={host.avatar_url || "https://ui-avatars.com/api/?name=" + (host.full_name || "U")}
              className="w-8 h-8 rounded-full object-cover"
              alt=""
            />
            <div className="flex-1">
              <p className="text-xs text-gray-400">Host / Pembuat Circle</p>
              <p className="text-sm font-medium">{host.nickname || host.full_name}</p>
            </div>
            {energy !== null && (
              <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full shrink-0">
                ⚡ {energy} (biaya -{createCost})
              </span>
            )}
          </div>
        )}

        {isPlus && (
          <div className="space-y-1">
            <label className="text-sm text-gray-500">Custom Cover</label>
            <div className="h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
              {form.cover_url && !coverError ? (
                <img
                  src={form.cover_url}
                  alt="cover"
                  className="w-full h-full object-cover"
                  onError={() => setCoverError(true)}
                />
              ) : (
                <span className="text-gray-400 text-sm text-center px-4">Pakai cover default sesuai aktivitas</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="text-sm text-primary font-medium cursor-pointer inline-block">
                {uploadingCover ? "Mengunggah..." : form.cover_url ? "Ganti Cover" : "Upload Cover"}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
              </label>
              {form.cover_url && (
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  disabled={uploadingCover}
                  className="text-sm text-red-500 font-medium disabled:opacity-40"
                >
                  Hapus
                </button>
              )}
            </div>
            {!form.cover_url && (
              <p className="text-xs text-gray-400">Tanpa custom cover, otomatis dipakai cover default sesuai aktivitas.</p>
            )}
          </div>
        )}

        <div ref={(el) => { fieldRefs.current.name = el; }}>
          <label className="text-sm text-gray-500">
            Nama Event{fieldErrors.name && <span className="text-red-500 font-medium"> — Wajib diisi</span>}
          </label>
          <input
            className={`w-full border rounded-xl px-3 py-2 ${fieldErrors.name ? "border-red-500" : ""}`}
            placeholder="Mis. Gowes Pagi Akhir Pekan"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: false });
            }}
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">Nama Grup <span className="text-gray-400">(opsional)</span></label>
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Mis. Circle Sepeda Santai"
            value={form.group_name}
            onChange={(e) => setForm({ ...form, group_name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">
            Jumlah Orang: <span className="font-semibold text-primary">{form.max_participants}</span> ({minP}-{maxP})
          </label>
          <input
            type="range"
            min={minP}
            max={maxP}
            step={1}
            value={form.max_participants}
            onChange={(e) => setForm({ ...form, max_participants: Number(e.target.value) })}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>{minP}</span>
            <span>{maxP}</span>
          </div>
        </div>

        <div ref={(el) => { fieldRefs.current.category = el; }}>
          <label className="text-sm text-gray-500">
            Aktivitas Circle{fieldErrors.category && <span className="text-red-500 font-medium"> — Wajib diisi</span>}
          </label>
          <select
            className={`w-full border rounded-xl px-3 py-2 ${fieldErrors.category ? "border-red-500" : ""}`}
            value={form.category}
            onChange={(e) => {
              setForm({ ...form, category: e.target.value });
              if (fieldErrors.category) setFieldErrors({ ...fieldErrors, category: false });
            }}
          >
            <option value="" disabled>Pilih Aktivitas</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div ref={(el) => { fieldRefs.current.city = el; }}>
          <label className="text-sm text-gray-500">
            Lokasi / Domisili{fieldErrors.city && <span className="text-red-500 font-medium"> — Wajib diisi</span>}
          </label>
          <div className={fieldErrors.city ? "rounded-xl ring-1 ring-red-500" : ""}>
            <LocationInput
              id="create-circle-city-list"
              value={form.city}
              onChange={(v) => {
                setForm({ ...form, city: v });
                if (fieldErrors.city) setFieldErrors({ ...fieldErrors, city: false });
              }}
              placeholder="Ketik nama kota..."
            />
          </div>
        </div>

        <div ref={(el) => { fieldRefs.current.location = el; }}>
          <label className="text-sm text-gray-500">
            Titik Kumpul{fieldErrors.location && <span className="text-red-500 font-medium"> — Wajib diisi</span>}
          </label>
          <input
            className={`w-full border rounded-xl px-3 py-2 ${fieldErrors.location ? "border-red-500" : ""}`}
            placeholder="Mis. Taman Kota, Gerbang Utara"
            value={form.location}
            onChange={(e) => {
              setForm({ ...form, location: e.target.value });
              if (fieldErrors.location) setFieldErrors({ ...fieldErrors, location: false });
            }}
          />
        </div>

        <div ref={(el) => { fieldRefs.current.event_date = el; }} className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">
              Tanggal{fieldErrors.event_date && <span className="text-red-500 font-medium"> — Wajib diisi</span>}
            </label>
            <input
              type="date"
              min={isEdit ? undefined : toDateValue(new Date().toISOString())}
              className={`w-full border rounded-xl px-3 py-2 ${fieldErrors.event_date ? "border-red-500" : ""}`}
              value={form.event_day}
              onChange={(e) => {
                setForm({ ...form, event_day: e.target.value });
                if (fieldErrors.event_date) setFieldErrors({ ...fieldErrors, event_date: false });
              }}
            />
          </div>

          <div ref={(el) => { fieldRefs.current.start_time = el; }}>
            <label className="text-sm text-gray-500">
              Jam Mulai{fieldErrors.start_time && <span className="text-red-500 font-medium"> — Wajib diisi</span>}
            </label>
            <input
              type="time"
              className={`w-full border rounded-xl px-3 py-2 ${fieldErrors.start_time ? "border-red-500" : ""}`}
              value={form.start_time}
              onChange={(e) => {
                setForm({ ...form, start_time: e.target.value });
                if (fieldErrors.start_time) setFieldErrors({ ...fieldErrors, start_time: false });
              }}
            />
          </div>
        </div>

        <div ref={(el) => { fieldRefs.current.description = el; }}>
          <label className="text-sm text-gray-500">
            Rundown / Detail Kegiatan{fieldErrors.description && <span className="text-red-500 font-medium"> — Wajib diisi</span>}
          </label>
          <textarea
            className={`w-full border rounded-xl px-3 py-2 ${fieldErrors.description ? "border-red-500" : ""}`}
            rows={3}
            placeholder="Mis. Kumpul 06.00, briefing, gowes 15km, sarapan bareng"
            value={form.description}
            onChange={(e) => {
              setForm({ ...form, description: e.target.value });
              if (fieldErrors.description) setFieldErrors({ ...fieldErrors, description: false });
            }}
          />
        </div>

        {isPlus && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_private}
                onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
              />
              Private / Invite Only (tidak tampil di Explore, hanya bisa join lewat link undangan)
            </label>

            <div>
              <label className="text-sm text-gray-500">Custom Invite Link (opsional)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 whitespace-nowrap">/join/</span>
                <input
                  className="w-full border rounded-xl px-3 py-2 uppercase"
                  placeholder="Otomatis kalau dikosongkan"
                  value={form.invite_code}
                  onChange={(e) => setForm({ ...form, invite_code: e.target.value.replace(/\s/g, "") })}
                  maxLength={20}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-500">Batasi peserta (opsional)</p>
              <select
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={form.join_gender}
                onChange={(e) => setForm({ ...form, join_gender: e.target.value })}
              >
                <option value="">Semua gender</option>
                <option value="female">Khusus perempuan</option>
                <option value="male">Khusus laki-laki</option>
              </select>
              <select
                className="w-full border rounded-xl px-3 py-2 bg-white"
                value={generationKey(form.join_birth_year_min, form.join_birth_year_max)}
                onChange={(e) => {
                  const g = GENERATIONS.find((x) => x.key === e.target.value);
                  if (e.target.value === "custom") return;
                  setForm({ ...form, join_birth_year_min: g?.min ?? null, join_birth_year_max: g?.max ?? null });
                }}
              >
                <option value="">Semua usia</option>
                {GENERATIONS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
                {generationKey(form.join_birth_year_min, form.join_birth_year_max) === "custom" && (
                  <option value="custom">
                    Rentang khusus ({form.join_birth_year_min ?? "…"}–{form.join_birth_year_max ?? "…"})
                  </option>
                )}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.join_verified_only}
                  onChange={(e) => setForm({ ...form, join_verified_only: e.target.checked })}
                />
                Hanya akun terverifikasi (centang biru)
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.requires_approval}
                onChange={(e) => setForm({ ...form, requires_approval: e.target.checked })}
              />
              Perlu approval host untuk join
            </label>

            {form.requires_approval && (
              <div>
                <label className="text-sm text-gray-500">Pertanyaan saat Join (opsional, wajib dijawab pelamar)</label>
                <input
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="Mis. Sudah pernah gowes berapa km?"
                  value={form.join_question}
                  onChange={(e) => setForm({ ...form, join_question: e.target.value })}
                  maxLength={200}
                />
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={handleCancel} className="flex-1 py-3 text-gray-500">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary text-white rounded-xl py-3 font-medium"
          >
            {saving ? "Menyimpan..." : isEdit ? "Simpan" : "Save"}
          </button>
        </div>
        </>
        )}
        </div>
      </div>
    </div>
  );
}
