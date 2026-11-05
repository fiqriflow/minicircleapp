"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X, ArrowLeft } from "lucide-react";
import { generateInviteCode } from "@/lib/inviteCode";
import { extractStoragePath } from "@/lib/storagePath";
import { compressImage, LONG_CACHE } from "@/lib/imageCompress";
import { toDateValue, toTimeValue, combineDateTime } from "@/lib/dateTimeLocal";
import LocationInput from "@/components/ui/LocationInput";
import { CATEGORIES } from "@/lib/categories";
import { ENERGY_COST, NO_SHOW_PENALTY, getMyEnergy, mapEnergyError, notifyEnergyChanged } from "@/lib/energy";

const CATEGORY_OPTIONS = ["Jogging", "Jalan Santai", "Gowes", "Renang", "Explore Alam"];

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
          invite_code: "", // diisi dari rpc get_circle_invite_code (kolom tidak terbaca client, migration 0048)
          join_question: editCircle.join_question ?? "",
          requires_approval: editCircle.requires_approval ?? false,
          join_gender: editCircle.join_gender ?? "",
          join_birth_year_min: editCircle.join_birth_year_min ?? null,
          join_birth_year_max: editCircle.join_birth_year_max ?? null,
          join_verified_only: editCircle.join_verified_only ?? false,
          allow_late_join: editCircle.allow_late_join ?? false,
          require_checkin: editCircle.require_checkin ?? true,
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
          allow_late_join: templateCircle.allow_late_join ?? false,
          require_checkin: templateCircle.require_checkin ?? true,
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
          allow_late_join: false,
          require_checkin: true,
        }
  );
  const [saving, setSaving] = useState(false);
  const [originalInviteCode, setOriginalInviteCode] = useState("");
  const [inviteLoaded, setInviteLoaded] = useState(!(isEdit && isPlus));
  useEffect(() => {
    if (!(isEdit && isPlus)) return;
    supabase.rpc("get_circle_invite_code", { p_circle_id: editCircle.id }).then(({ data, error }: any) => {
      if (error) toast.error("Kode undangan gagal dimuat. Kode yang lama tidak akan diubah.");
      const code = (data as string | null) ?? "";
      setOriginalInviteCode(code);
      setForm((f: any) => ({ ...f, invite_code: code }));
      setInviteLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [host, setHost] = useState<any>(null);
  const [hostChecked, setHostChecked] = useState(false);
  const [energy, setEnergy] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // ===== Wizard per langkah (gaya Duolingo) =====
  // 1 Dasar · 2 Lokasi · 3 Waktu · 4 Peserta & rundown · (Circle+) 5 Tampilan & akses · 6 Aturan join
  const formSteps = isPlus ? 6 : 4;
  const totalSteps = formSteps + 1; // langkah terakhir = Review sebelum menyimpan
  const reviewStep = totalSteps;
  const [step, setStep] = useState(1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const STEP_OF: Record<string, number> = { name: 1, category: 1, city: 2, location: 2, event_date: 3, start_time: 3, description: 4 };
  const STEP_TITLE: Record<number, { title: string; hint: string }> = {
    1: { title: "Circle apa ini?", hint: "Kasih nama & pilih aktivitasnya." },
    2: { title: "Ketemu di mana?", hint: "Kota dan titik kumpul." },
    3: { title: "Kapan mulainya?", hint: "Tanggal & jam mulai." },
    4: { title: "Siapa aja yang ikut?", hint: "Jumlah orang dan rundown kegiatan." },
    5: { title: "Tampilan & akses", hint: "Cover, private, dan link undangan." },
    6: { title: "Aturan join", hint: "Batasi peserta & atur approval." },
  };
  const stepInfo =
    step === reviewStep
      ? { title: "Cek lagi, ya!", hint: isEdit ? "Pastikan perubahan sudah benar sebelum disimpan." : "Pastikan semuanya sudah benar sebelum circle dibuat." }
      : STEP_TITLE[step];
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // opsi check-in terkunci kalau circle sudah dimulai / selesai / lewat jam mulai (juga dijaga di DB)
  const checkinLocked =
    isEdit && (!!editCircle.started_at || editCircle.status !== "active" || new Date(editCircle.event_date) <= new Date());
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
      const { data } = await supabase.rpc("get_my_profile").maybeSingle();
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
      up = await compressImage(file, { maxSize: 960, quality: 0.8 });
    } catch {
      toast.error("Gagal memproses gambar");
      setUploadingCover(false);
      return;
    }
    const path = `${Date.now()}.${up.ext}`;
    const { error: uploadError } = await supabase.storage
      .from("circle-covers")
      .upload(path, up.blob, { upsert: true, contentType: up.contentType, cacheControl: LONG_CACHE });
    if (uploadError) {
      toast.error("Gagal upload cover: " + uploadError.message);
      setUploadingCover(false);
      return;
    }
    const { data } = supabase.storage.from("circle-covers").getPublicUrl(path);
    // Cover ASLI circle yang sedang diedit baru boleh dihapus setelah Simpan berhasil (kalau batal, cover harus
    // tetap ada). Di sini hanya file yang diupload di sesi ini yang dibersihkan.
    const originalCoverUrl = editCircle?.cover_url ?? "";
    const oldPath =
      form.cover_url && form.cover_url !== originalCoverUrl ? extractStoragePath(form.cover_url, "circle-covers") : null;
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
      setStep(STEP_OF[missing[0].key] ?? 1);
      return;
    }
    setFieldErrors({});
    const slots = Number(form.max_participants);
    if (!Number.isInteger(slots) || slots < minP || slots > maxP) {
      setStep(4);
      setError(`Jumlah peserta harus ${minP}–${maxP} orang.`);
      return;
    }
    const startIso = combineDateTime(form.event_day, form.start_time);
    if (!startIso) {
      setStep(3);
      setError("Tanggal & jam tidak valid.");
      return;
    }
    if (!isEdit && new Date(startIso) < new Date()) {
      setFieldErrors({ start_time: true });
      setStep(3);
      setError("Tanggal & jam mulai tidak boleh yang sudah lewat. Pilih waktu di masa depan.");
      return;
    }
    // kode undangan buatan sendiri: min 6 karakter, hanya A-Z 0-9 - _ (aman dipakai di URL)
    const customCode = form.invite_code.trim().toUpperCase();
    if (isPlus && customCode && customCode !== originalInviteCode.toUpperCase()) {
      if (customCode.length < 6) {
        setStep(5);
        setError("Kode undangan minimal 6 karakter biar tidak mudah ditebak.");
        return;
      }
      if (!/^[A-Z0-9_-]+$/.test(customCode)) {
        setStep(5);
        setError("Kode undangan hanya boleh huruf, angka, tanda - dan _.");
        return;
      }
    }
    if (!inviteLoaded) {
      setError("Memuat kode undangan, coba lagi sebentar.");
      return;
    }
    setSaving(true);
    setError("");

    const payload: any = {
      name: form.name.trim(),
      group_name: form.group_name.trim() || null,
      max_participants: form.max_participants,
      category: form.category,
      city: form.city.trim(),
      location: form.location.trim(),
      event_date: startIso,
      description: form.description.trim(),
      allow_late_join: form.allow_late_join,
      require_checkin: form.require_checkin,
    };

    if (isPlus) {
      payload.cover_url = form.cover_url || null;
      payload.is_private = form.is_private;
      if (isEdit) {
        // Edit: kirim kode HANYA kalau memang diubah. Dulu kode kosong (mis. gagal dimuat) diganti kode acak
        // -> link undangan yang sudah dibagikan mati diam-diam.
        if (customCode && customCode !== originalInviteCode.toUpperCase()) payload.invite_code = customCode;
      } else {
        payload.invite_code = (form.invite_code.trim() || generateInviteCode()).toUpperCase();
      }
      // pertanyaan join hanya berlaku kalau approval aktif (dijaga juga di DB, migration 0043)
      payload.requires_approval = form.requires_approval;
      // filter peserta (juga dijaga di DB, migration 0047)
      payload.join_gender = form.join_gender || null;
      // filter generasi dihapus: pastikan selalu kosong (juga membersihkan circle lama saat diedit)
      payload.join_birth_year_min = null;
      payload.join_birth_year_max = null;
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
      const hostRow = { circle_id: newCircle.id, user_id: user.id, status: "joined" };
      let { error: joinError } = await supabase.from("circle_members").insert(hostRow);
      if (joinError) ({ error: joinError } = await supabase.from("circle_members").insert(hostRow)); // coba sekali lagi
      if (joinError) {
        toast.warning("Circle sudah dibuat, tapi kamu belum masuk line up. Buka circle-nya lalu coba lagi.");
      }
    }

    setSaving(false);
    notifyEnergyChanged();
    onCreated();
    onClose();
  };

  // Validasi per langkah sebelum lanjut. Validasi lengkap tetap dijalankan lagi di handleSave.
  const validateStep = (st: number) => {
    const checks: Record<number, { key: string; label: string; ok: boolean }[]> = {
      1: [
        { key: "name", label: "Nama Event", ok: !!form.name.trim() },
        { key: "category", label: "Aktivitas Circle", ok: !!form.category },
      ],
      2: [
        { key: "city", label: "Lokasi / Domisili", ok: !!form.city.trim() },
        { key: "location", label: "Titik Kumpul", ok: !!form.location.trim() },
      ],
      3: [
        { key: "event_date", label: "Tanggal", ok: !!form.event_day },
        { key: "start_time", label: "Jam Mulai", ok: !!form.start_time },
      ],
      4: [{ key: "description", label: "Rundown / Detail Kegiatan", ok: !!form.description.trim() }],
    };
    const missing = (checks[st] ?? []).filter((f) => !f.ok);
    if (missing.length) {
      const errs: Record<string, boolean> = {};
      missing.forEach((f) => (errs[f.key] = true));
      setFieldErrors((prev) => ({ ...prev, ...errs }));
      setError("");
      toast.error(`Lengkapi dulu "${missing[0].label}".`);
      return false;
    }
    if (st === 3 && !isEdit) {
      const iso = combineDateTime(form.event_day, form.start_time);
      if (!iso || new Date(iso) < new Date()) {
        setFieldErrors((prev) => ({ ...prev, start_time: true }));
        setError("Tanggal & jam mulai tidak boleh yang sudah lewat. Pilih waktu di masa depan.");
        return false;
      }
    }
    if (st === 5 && isPlus) {
      const code = form.invite_code.trim().toUpperCase();
      if (code && code !== originalInviteCode.toUpperCase()) {
        if (code.length < 6) {
          setError("Kode undangan minimal 6 karakter biar tidak mudah ditebak.");
          return false;
        }
        if (!/^[A-Z0-9_-]+$/.test(code)) {
          setError("Kode undangan hanya boleh huruf, angka, tanda - dan _.");
          return false;
        }
      }
    }
    setError("");
    return true;
  };

  const handleNext = () => {
    if (step < totalSteps) {
      if (validateStep(step)) setStep(step + 1);
      return;
    }
    handleSave();
  };

  const handleBack = () => {
    setError("");
    setStep((st) => Math.max(1, st - 1));
  };

  const categoryCards = [
    ...CATEGORY_OPTIONS,
    // circle lama dengan kategori yang sudah dihapus tetap tampil supaya tidak hilang saat diedit
    ...(form.category && !CATEGORY_OPTIONS.includes(form.category) ? [form.category] : []),
  ].map((label) => ({ label, Icon: CATEGORIES.find((c) => c.label === label)?.icon }));

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

  // ===== Ringkasan (langkah Review) =====
  const reviewWhen = (() => {
    const iso = combineDateTime(form.event_day, form.start_time);
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  })();
  const genderLabel = form.join_gender === "female" ? "Khusus perempuan" : form.join_gender === "male" ? "Khusus laki-laki" : "Semua gender";
  const reviewGroup = (title: string, toStep: number, rows: [string, React.ReactNode][]) => (
    <div className="border-2 border-gray-200 rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold text-gray-700">{title}</p>
        <button type="button" onClick={() => setStep(toStep)} className="btn-flat text-xs font-bold text-primary">
          Ubah
        </button>
      </div>
      {rows.map(([label, value]) => (
        <div key={label} className="text-sm">
          <span className="text-gray-400">{label}</span>
          <div className="text-gray-700 break-words">{value || "-"}</div>
        </div>
      ))}
    </div>
  );

  const clearErr = (k: string) => {
    if (fieldErrors[k]) setFieldErrors({ ...fieldErrors, [k]: false });
  };

  return (
    <div
      className="fixed inset-x-0 top-0 bg-black/40 flex items-end justify-center z-50"
      style={{ height: viewportHeight ? `${viewportHeight}px` : "100vh" }}
    >
      <div className="bg-white rounded-t-2xl w-full max-w-md h-[92%] flex flex-col overflow-hidden">
        {/* Header: tutup + progress bar */}
        <div className="shrink-0 bg-white px-4 pt-4 pb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            aria-label="Tutup"
            className="btn-flat p-1.5 -ml-1.5 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={22} />
          </button>
          {!profileIncomplete ? (
            <div className="flex-1 h-3 rounded-full bg-gray-200 overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step}>
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          ) : (
            <h2 className="font-bold text-lg flex-1">{isEdit ? "Edit Circle" : `Buat ${isPlus ? "Circle+" : "Circle"}`}</h2>
          )}
          {!profileIncomplete && (
            <span className="text-xs font-bold text-gray-400 shrink-0">
              {step}/{totalSteps}
            </span>
          )}
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain px-6 pb-4 space-y-4" onFocusCapture={handleFieldFocus}>
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
        <div>
          <h2 className="text-2xl font-extrabold text-gray-800">{stepInfo.title}</h2>
          <p className="text-sm text-gray-500">{stepInfo.hint}</p>
          {step === 1 && !isEdit && templateCircle && (
            <p className="text-xs text-gray-400 mt-1">Salinan dari "{templateCircle.name}" — isi tanggal & jam baru</p>
          )}
          {step === 1 && isEdit && <p className="text-xs text-gray-400 mt-1">Mengedit circle</p>}
        </div>

        {/* ===== LANGKAH 1: DASAR ===== */}
        {step === 1 && (
          <>
            {host && !isEdit && (
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                <img
                  src={host.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(host.full_name || "U")}
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
                  clearErr("name");
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

            <div ref={(el) => { fieldRefs.current.category = el; }}>
              <label className="text-sm text-gray-500">
                Aktivitas Circle{fieldErrors.category && <span className="text-red-500 font-medium"> — Pilih salah satu</span>}
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {categoryCards.map(({ label, Icon }) => {
                  const active = form.category === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, category: label });
                        clearErr("category");
                      }}
                      className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-bold text-left ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : fieldErrors.category
                          ? "border-red-300 text-gray-600"
                          : "border-gray-200 text-gray-600"
                      }`}
                    >
                      {Icon ? <Icon size={20} className="shrink-0" /> : <span className="w-5 shrink-0" />}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ===== LANGKAH 2: LOKASI ===== */}
        {step === 2 && (
          <>
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
                    clearErr("city");
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
                  clearErr("location");
                }}
              />
            </div>
          </>
        )}

        {/* ===== LANGKAH 3: WAKTU ===== */}
        {step === 3 && (
          <>
            <div ref={(el) => { fieldRefs.current.event_date = el; }}>
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
                  clearErr("event_date");
                }}
              />
            </div>

            <div ref={(el) => { fieldRefs.current.start_time = el; }}>
              <label className="text-sm text-gray-500">
                Jam Mulai{fieldErrors.start_time && <span className="text-red-500 font-medium"> — Cek lagi</span>}
              </label>
              <input
                type="time"
                className={`w-full border rounded-xl px-3 py-2 ${fieldErrors.start_time ? "border-red-500" : ""}`}
                value={form.start_time}
                onChange={(e) => {
                  setForm({ ...form, start_time: e.target.value });
                  clearErr("start_time");
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allow_late_join}
                  onChange={(e) => setForm({ ...form, allow_late_join: e.target.checked })}
                />
                Izinkan join setelah circle dimulai
              </label>
              <p className="text-xs text-gray-400">
                Kalau mati (default), pendaftaran ditutup begitu jam mulai tiba atau kamu menekan &quot;Tandai Mulai&quot;. Kalau aktif, orang baru masih bisa join sampai 3 jam setelah jam mulai.
              </p>
            </div>
          </>
        )}

        {/* ===== LANGKAH 4: PESERTA & RUNDOWN ===== */}
        {step === 4 && (
          <>
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

            <div className="space-y-1">
              <label className={`flex items-center gap-2 text-sm ${checkinLocked ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  checked={form.require_checkin}
                  disabled={checkinLocked}
                  onChange={(e) => setForm({ ...form, require_checkin: e.target.checked })}
                />
                Pakai check-in peserta
              </label>
              <p className="text-xs text-gray-400">
                {checkinLocked
                  ? "Tidak bisa diubah setelah circle dimulai."
                  : form.require_checkin
                  ? `Peserta check-in saat acara. Yang tidak check-in kena penalti ${NO_SHOW_PENALTY} energy saat circle selesai.`
                  : "Tanpa check-in: tidak ada penalti, semua peserta yang join dianggap hadir."}
              </p>
            </div>

            <div ref={(el) => { fieldRefs.current.description = el; }}>
              <label className="text-sm text-gray-500">
                Rundown / Detail Kegiatan{fieldErrors.description && <span className="text-red-500 font-medium"> — Wajib diisi</span>}
              </label>
              <textarea
                className={`w-full border rounded-xl px-3 py-2 ${fieldErrors.description ? "border-red-500" : ""}`}
                rows={5}
                placeholder="Mis. Kumpul 06.00, briefing, gowes 15km, sarapan bareng"
                value={form.description}
                onChange={(e) => {
                  setForm({ ...form, description: e.target.value });
                  clearErr("description");
                }}
              />
            </div>
          </>
        )}

        {/* ===== LANGKAH 5 (Circle+): TAMPILAN & AKSES ===== */}
        {isPlus && step === 5 && (
          <>
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
                    className="btn-flat text-sm text-red-500 font-medium disabled:opacity-40"
                  >
                    Hapus
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Ukuran ideal: <span className="font-medium text-gray-500">800 x 450 px</span> (rasio 16:9), format JPG/PNG, maks 1MB.
              </p>
              {!form.cover_url && (
                <p className="text-xs text-gray-400">Tanpa custom cover, otomatis dipakai cover default sesuai aktivitas.</p>
              )}
            </div>

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
          </>
        )}

        {/* ===== LANGKAH 6 (Circle+): ATURAN JOIN ===== */}
        {isPlus && step === 6 && (
          <>
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

        {/* ===== LANGKAH TERAKHIR: REVIEW ===== */}
        {step === reviewStep && (
          <div className="space-y-3">
            {reviewGroup("Dasar", 1, [
              ["Nama event", form.name],
              ["Nama grup", form.group_name],
              ["Aktivitas", form.category],
            ])}
            {reviewGroup("Lokasi", 2, [
              ["Kota / domisili", form.city],
              ["Titik kumpul", form.location],
            ])}
            {reviewGroup("Waktu", 3, [
              ["Mulai", reviewWhen],
              ["Join setelah dimulai", form.allow_late_join ? "Diizinkan (sampai 3 jam)" : "Ditutup saat dimulai"],
            ])}
            {reviewGroup("Peserta", 4, [
              ["Jumlah orang", `${form.max_participants} orang`],
              ["Check-in peserta", form.require_checkin ? `Ya (tidak check-in: -${NO_SHOW_PENALTY} energy)` : "Tidak pakai check-in"],
              ["Rundown", <p key="d" className="whitespace-pre-wrap line-clamp-4">{form.description}</p>],
            ])}
            {isPlus &&
              reviewGroup("Tampilan & akses", 5, [
                ["Cover", form.cover_url && !coverError ? (
                  <img key="c" src={form.cover_url} alt="cover" className="w-full h-24 object-cover rounded-xl mt-1" />
                ) : "Cover default sesuai aktivitas"],
                ["Visibilitas", form.is_private ? "Private (hanya lewat link undangan)" : "Tampil di Explore"],
                ["Link undangan", form.invite_code.trim() ? `/join/${form.invite_code.trim().toUpperCase()}` : "Dibuat otomatis"],
              ])}
            {isPlus &&
              reviewGroup("Aturan join", 6, [
                ["Peserta", genderLabel + (form.join_verified_only ? " · hanya akun terverifikasi" : "")],
                ["Approval host", form.requires_approval ? "Perlu approval" : "Langsung masuk"],
                ...(form.requires_approval && form.join_question.trim()
                  ? ([["Pertanyaan join", form.join_question.trim()]] as [string, React.ReactNode][])
                  : []),
              ])}
            {!isEdit && (
              <p className="text-xs text-yellow-700 bg-yellow-50 rounded-xl p-3">
                ⚡ Membuat circle memakai {createCost} energy
                {energy !== null ? ` (sisa ${energy} → ${Math.max(0, energy - createCost)})` : ""}.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        </>
        )}
        </div>

        {/* Footer tetap: Kembali / Lanjut */}
        {!profileIncomplete && (
          <div className="shrink-0 border-t-2 border-gray-200 bg-white px-4 py-3 flex gap-2">
            <button
              type="button"
              onClick={step === 1 ? handleCancel : handleBack}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-500 font-bold flex items-center justify-center gap-1"
            >
              {step === 1 ? "Batal" : (<><ArrowLeft size={16} /> Kembali</>)}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={saving || uploadingCover}
              className="flex-[2] bg-primary text-white rounded-xl py-3 font-bold disabled:opacity-60"
            >
              {step < totalSteps ? "Lanjut" : saving ? "Menyimpan..." : isEdit ? "Simpan" : "Buat Circle"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
