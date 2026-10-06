"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ImagePlus } from "lucide-react";
import AvatarCropModal from "@/components/profile/AvatarCropModal";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import { LONG_CACHE } from "@/lib/imageCompress";
import { AVATAR_PRESET_BUCKET, fetchAvatarPresets, type AvatarPreset } from "@/lib/avatarPresets";

// Crop berasal dari file baru (tambah) atau ganti gambar preset yang ada
type CropTarget = { file: File; replaceId: string | null };

export default function AdminAvatarPage() {
  const supabase = createClient();
  const [items, setItems] = useState<AvatarPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropTarget | null>(null);
  const [newName, setNewName] = useState("");
  const [uploading, setUploading] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
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

  // ===== CREATE / REPLACE IMAGE (setelah crop) =====
  const handleCropConfirm = async (blob: Blob) => {
    if (!crop) return;
    const target = crop;
    setCrop(null);
    setUploading(true);
    if (target.replaceId) setBusyId(target.replaceId);

    let uploaded: { path: string; url: string } | null = null;
    try {
      uploaded = await uploadBlob(blob);

      if (target.replaceId) {
        const { data: oldPath, error } = await supabase.rpc("admin_replace_avatar_preset_image", {
          p_id: target.replaceId,
          p_url: uploaded.url,
          p_path: uploaded.path,
        });
        if (error) throw new Error(error.message);
        await removeFile(oldPath as string | null);
        toast.success("Gambar avatar diganti.");
      } else {
        const name = newName.trim();
        const nextOrder = items.length ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
        const { error } = await supabase.from("avatar_presets").insert({
          name,
          image_url: uploaded.url,
          storage_path: uploaded.path,
          sort_order: nextOrder,
        });
        if (error) throw new Error(error.message);
        setNewName("");
        setPendingFile(null);
        toast.success("Avatar ditambahkan.");
      }
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
        `Hapus avatar "${item.name}"? User yang sedang memakainya akan kembali ke avatar default. Tidak bisa dikembalikan.`
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
    await removeFile((path as string | null) ?? item.storage_path);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setBusyId(null);
    toast.success("Avatar dihapus.");
  };

  const canAdd = newName.trim().length > 0 && !!pendingFile && !uploading;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Avatar</h1>
        <p className="text-sm text-gray-500">
          Avatar preset yang bisa dipilih user saat onboarding. Gambar otomatis di-crop persegi 256×256.
        </p>
      </div>

      {/* TAMBAH */}
      <div className="bg-white border rounded-2xl p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Plus size={16} /> Tambah Avatar
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className="flex-1 border rounded-xl px-4 py-2"
            placeholder="Nama avatar (maks 40 karakter)"
            maxLength={40}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="button"
            onClick={() => addInputRef.current?.click()}
            className="border rounded-xl px-4 py-2 text-sm flex items-center justify-center gap-2"
          >
            <ImagePlus size={16} /> {pendingFile ? pendingFile.name.slice(0, 20) : "Pilih Gambar"}
          </button>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => pendingFile && setCrop({ file: pendingFile, replaceId: null })}
            className="bg-primary text-white rounded-xl px-5 py-2 text-sm font-medium disabled:opacity-40"
          >
            {uploading && !busyId ? "Mengunggah..." : "Crop & Simpan"}
          </button>
        </div>
        <input
          ref={addInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPendingFile(f);
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

      {crop && (
        <AvatarCropModal file={crop.file} onCancel={() => setCrop(null)} onConfirm={handleCropConfirm} />
      )}
    </div>
  );
}
