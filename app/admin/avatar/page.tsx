"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ImagePlus, X } from "lucide-react";
import AvatarCropModal from "@/components/profile/AvatarCropModal";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { LONG_CACHE } from "@/lib/imageCompress";
import { AVATAR_PRESET_BUCKET, fetchAvatarPresets, type AvatarPreset } from "@/lib/avatarPresets";

// Crop berasal dari file baru (tambah) atau ganti gambar preset yang ada
type CropTarget = { file: File; replaceId: string | null };
type BatchItem = { id: string; file: File; name: string; url: string };

const MAX_BATCH = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file

// Crop tengah otomatis -> 400x400 JPG (sama dengan hasil AvatarCropModal tanpa zoom/geser)
async function autoCropBlob(file: File): Promise<Blob> {
  if ((file.type && !file.type.startsWith("image/")) || file.size > MAX_FILE_BYTES) {
    throw new Error("File harus gambar maks 10 MB");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Gambar tidak bisa dibuka"));
      el.src = url;
    });
    const size = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - size) / 2;
    const sy = (img.naturalHeight - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia");
    ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal memproses gambar"))), "image/jpeg", 0.8)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AdminAvatarPage() {
  const supabase = createClient();
  const [items, setItems] = useState<AvatarPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropTarget | null>(null);
  const [uploading, setUploading] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  // batch upload (maks 10 gambar sekali proses)
  const [queue, setQueue] = useState<BatchItem[]>([]);
  const [autoCrop, setAutoCrop] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchCropFile, setBatchCropFile] = useState<File | null>(null);
  const batchResolveRef = useRef<((b: Blob | null) => void) | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceIdRef = useRef<string | null>(null);

  const load = async () => {
    const { data, error } = await fetchAvatarPresets(supabase, false);
    if (error) toast.error("Gagal memuat avatar: " + error.message);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const uploadBlob = async (blob: Blob) => {
    const path = `${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from(AVATAR_PRESET_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", cacheControl: LONG_CACHE });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(AVATAR_PRESET_BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  };

  const removeFile = async (path: string | null | undefined) => {
    if (path) await supabase.storage.from(AVATAR_PRESET_BUCKET).remove([path]);
  };

  // ===== BATCH ADD (maks 10) =====
  const addToQueue = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_BATCH - queue.length;
    if (room <= 0) {
      toast.error(`Maksimal ${MAX_BATCH} gambar sekali proses.`);
      return;
    }
    const picked = Array.from(files);
    if (picked.length > room) toast.error(`Maksimal ${MAX_BATCH} gambar. ${picked.length - room} file diabaikan.`);
    const next: BatchItem[] = picked.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name.replace(/\.[^.]+$/, "").slice(0, 40),
      url: URL.createObjectURL(file),
    }));
    setQueue((prev) => [...prev, ...next]);
  };

  const removeFromQueue = (id: string) =>
    setQueue((prev) => {
      const t = prev.find((q) => q.id === id);
      if (t) URL.revokeObjectURL(t.url);
      return prev.filter((q) => q.id !== id);
    });

  const askCrop = (file: File) =>
    new Promise<Blob | null>((resolve) => {
      batchResolveRef.current = resolve;
      setBatchCropFile(file);
    });

  const resolveCrop = (blob: Blob | null) => {
    setBatchCropFile(null);
    batchResolveRef.current?.(blob);
    batchResolveRef.current = null;
  };

  const processBatch = async () => {
    if (uploading || queue.length === 0) return;
    setUploading(true);
    const list = [...queue];
    let order = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
    let ok = 0;
    let fail = 0;
    let skipped = 0;

    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      setProgress({ done: i, total: list.length });
      let blob: Blob | null = null;
      try {
        blob = autoCrop ? await autoCropBlob(q.file) : await askCrop(q.file);
      } catch (e: any) {
        toast.error(`${q.file.name}: ${e?.message ?? "gagal diproses"}`);
        fail++;
        continue;
      }
      if (!blob) {
        skipped++;
        continue;
      }
      let uploaded: { path: string; url: string } | null = null;
      try {
        uploaded = await uploadBlob(blob);
        const { error } = await supabase.from("avatar_presets").insert({
          name: q.name.trim(),
          image_url: uploaded.url,
          storage_path: uploaded.path,
          sort_order: order,
        });
        if (error) throw new Error(error.message);
        order++;
        ok++;
        removeFromQueue(q.id); // yang berhasil keluar dari antrian; gagal/dilewati tetap untuk dicoba lagi
      } catch (e: any) {
        await removeFile(uploaded?.path); // rollback file yang sudah terupload
        toast.error(`${q.name}: ${e?.message ?? "gagal"}`);
        fail++;
      }
    }

    setProgress(null);
    setUploading(false);
    await load();
    if (ok) toast.success(`${ok} avatar ditambahkan.`);
    if (fail || skipped) toast.message(`${fail} gagal, ${skipped} dilewati. Masih ada di antrian.`);
  };

  // ===== REPLACE IMAGE (setelah crop) =====
  const handleCropConfirm = async (blob: Blob) => {
    if (!crop || !crop.replaceId) return;
    const target = crop as { file: File; replaceId: string };
    setCrop(null);
    setUploading(true);
    setBusyId(target.replaceId);

    let uploaded: { path: string; url: string } | null = null;
    try {
      uploaded = await uploadBlob(blob);

      const { data: oldPath, error } = await supabase.rpc("admin_replace_avatar_preset_image", {
        p_id: target.replaceId,
        p_url: uploaded.url,
        p_path: uploaded.path,
      });
      if (error) throw new Error(error.message);
      await removeFile(oldPath as string | null);
      toast.success("Gambar avatar diganti.");
      await load();
    } catch (e: any) {
      await removeFile(uploaded?.path); // rollback file yang sudah terupload
      toast.error("Gagal: " + (e?.message ?? "tidak diketahui"));
    }
    setUploading(false);
    setBusyId(null);
  };

  // ===== UPDATE (nama / urutan / aktif) =====
  const patch = async (id: string, values: Partial<Pick<AvatarPreset, "name" | "sort_order" | "is_active">>) => {
    setBusyId(id);
    const { error } = await supabase.from("avatar_presets").update(values).eq("id", id);
    setBusyId(null);
    if (error) {
      toast.error("Gagal simpan: " + error.message);
      return false;
    }
    setItems((prev) =>
      [...prev.map((i) => (i.id === id ? { ...i, ...values } : i))].sort(
        (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
      )
    );
    return true;
  };

  const saveName = async (item: AvatarPreset, value: string) => {
    const name = value.trim();
    if (!name) {
      toast.error("Nama tidak boleh kosong.");
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i } : i)));
      return;
    }
    if (name === item.name) return;
    if (await patch(item.id, { name })) toast.success("Nama disimpan.");
  };

  const saveOrder = async (item: AvatarPreset, value: string) => {
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n === item.sort_order) return;
    await patch(item.id, { sort_order: n });
  };

  // ===== DELETE =====
  const handleDelete = async (item: AvatarPreset) => {
    if (
      !confirm(
        `Hapus avatar "${item.name}" dari daftar pilihan? Foto profil user yang sudah memilihnya tidak berubah. Tidak bisa dikembalikan.`
      )
    )
      return;
    setBusyId(item.id);
    const { data: path, error } = await supabase.rpc("admin_delete_avatar_preset", { p_id: item.id });
    if (error) {
      toast.error("Gagal hapus: " + error.message);
      setBusyId(null);
      return;
    }
    await removeFile(path as string | null); // null = masih dipakai profil lama, file dipertahankan
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setBusyId(null);
    toast.success("Avatar dihapus.");
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Avatar</h1>
        <p className="text-sm text-gray-500">
          Avatar preset yang bisa dipilih user saat onboarding.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-900 space-y-1">
        <p className="font-semibold">Rekomendasi gambar</p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>Rasio <b>1:1 (persegi)</b>, ukuran ideal <b>512×512 px</b> (minimal 256×256 px)</li>
          <li>Format JPG, PNG, atau WebP; ukuran file asli disarankan di bawah 2 MB</li>
          <li>Objek di tengah gambar, karena tampil dalam bingkai <b>lingkaran</b> (sudut gambar terpotong)</li>
          <li>Latar polos/solid; PNG transparan akan jadi latar hitam setelah crop</li>
          <li>Hasil akhir otomatis di-crop & dikompres ke 256×256 px JPG (sekitar 15–40 KB)</li>
          <li>Upload sekaligus maks 10 gambar. Nama default diambil dari nama file (bisa diedit). Batal di crop manual = gambar dilewati</li>
          <li>Nama maks 40 karakter; urutan kecil tampil lebih dulu; avatar nonaktif disembunyikan dari user</li>
        </ul>
      </div>

      {/* TAMBAH (batch, maks 10) */}
      <div className="bg-white border rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Plus size={16} /> Tambah Avatar (maks {MAX_BATCH} sekali proses)
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <button
            type="button"
            disabled={uploading || queue.length >= MAX_BATCH}
            onClick={() => addInputRef.current?.click()}
            className="border rounded-xl px-4 py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <ImagePlus size={16} /> Pilih Gambar ({queue.length}/{MAX_BATCH})
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoCrop}
              disabled={uploading}
              onChange={(e) => setAutoCrop(e.target.checked)}
            />
            Crop otomatis (tengah). Matikan untuk crop manual satu per satu.
          </label>
        </div>

        {queue.length > 0 && (
          <div className="space-y-2">
            {queue.map((q) => (
              <div key={q.id} className="flex items-center gap-2">
                <img src={q.url} alt="" className="w-10 h-10 rounded-full object-cover border shrink-0" />
                <input
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                  maxLength={40}
                  value={q.name}
                  disabled={uploading}
                  placeholder="Nama avatar"
                  onChange={(e) =>
                    setQueue((prev) => prev.map((x) => (x.id === q.id ? { ...x, name: e.target.value } : x)))
                  }
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => removeFromQueue(q.id)}
                  aria-label="Hapus dari antrian"
                  className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-40"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={uploading || queue.some((q) => !q.name.trim())}
              onClick={processBatch}
              className="bg-primary text-white rounded-xl px-5 py-2 text-sm font-medium disabled:opacity-40"
            >
              {progress ? `Mengunggah ${Math.min(progress.done + 1, progress.total)}/${progress.total}...` : `Simpan ${queue.length} Avatar`}
            </button>
          </div>
        )}

        <input
          ref={addInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addToQueue(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* LIST */}
      {loading ? (
        <p className="text-gray-400">Memuat...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-sm">Belum ada avatar. Tambah di atas.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const busy = busyId === item.id;
            return (
              <div
                key={item.id}
                className={`bg-white border rounded-2xl p-3 flex gap-3 items-center ${
                  item.is_active ? "" : "opacity-60"
                }`}
              >
                <button
                  type="button"
                  disabled={busy || uploading}
                  onClick={() => {
                    replaceIdRef.current = item.id;
                    replaceInputRef.current?.click();
                  }}
                  title="Klik untuk ganti gambar"
                  className="relative shrink-0"
                >
                  <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-full object-cover border" />
                  {busy && (
                    <span className="absolute inset-0 rounded-full bg-white/70 text-[10px] flex items-center justify-center">
                      ...
                    </span>
                  )}
                </button>

                <div className="flex-1 min-w-0 space-y-1">
                  <input
                    key={item.name}
                    defaultValue={item.name}
                    maxLength={40}
                    disabled={busy}
                    onBlur={(e) => saveName(item, e.target.value)}
                    className="w-full border rounded-lg px-2 py-1 text-sm"
                    aria-label="Nama avatar"
                  />
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Urutan</span>
                    <input
                      key={item.sort_order}
                      type="number"
                      defaultValue={item.sort_order}
                      disabled={busy}
                      onBlur={(e) => saveOrder(item, e.target.value)}
                      className="w-16 border rounded-lg px-2 py-1 text-sm"
                      aria-label="Urutan"
                    />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <ToggleSwitch
                    checked={item.is_active}
                    disabled={busy}
                    label={item.is_active ? "Nonaktifkan avatar" : "Aktifkan avatar"}
                    onChange={() => patch(item.id, { is_active: !item.is_active })}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleDelete(item)}
                    className="text-red-500 text-xs flex items-center gap-1 disabled:opacity-40"
                  >
                    <Trash2 size={14} /> Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && replaceIdRef.current) setCrop({ file: f, replaceId: replaceIdRef.current });
          e.target.value = "";
        }}
      />

      {batchCropFile && (
        <AvatarCropModal
          key={batchCropFile.name + batchCropFile.size + batchCropFile.lastModified}
          file={batchCropFile}
          onCancel={() => resolveCrop(null)}
          onConfirm={(b) => resolveCrop(b)}
        />
      )}

      {crop && (
        <AvatarCropModal file={crop.file} onCancel={() => setCrop(null)} onConfirm={handleCropConfirm} />
      )}
    </div>
  );
}
