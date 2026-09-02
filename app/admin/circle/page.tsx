"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractStoragePath } from "@/lib/storagePath";
import { getCirclePlusEnabled } from "@/lib/appSettings";
import { toDateTimeLocalValue, fromDateTimeLocalValue } from "@/lib/dateTimeLocal";
import ChooseCircleTypeModal from "@/components/ChooseCircleTypeModal";
import CreateCircleModal from "@/components/CreateCircleModal";

export default function AdminCirclePage() {
  const supabase = createClient();
  const [circles, setCircles] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<any>(null); // form edit (existing circle)
  const [uploading, setUploading] = useState(false);
  const [showChooser, setShowChooser] = useState(false);
  const [createType, setCreateType] = useState<"regular" | "plus" | null>(null);
  const [circlePlusEnabled, setCirclePlusEnabled] = useState(true);

  const load = async () => {
    const { data } = await supabase.from("circles").select("*").order("event_date", { ascending: false });
    setCircles(data ?? []);
  };

  useEffect(() => {
    load();
    getCirclePlusEnabled(supabase).then(setCirclePlusEnabled);
  }, []);

  const openEdit = (c: any) => setEditForm({ ...c });

  const handleSaveEdit = async () => {
    await supabase.from("circles").update(editForm).eq("id", editForm.id);
    setEditForm(null);
    load();
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${editForm.id ?? "new"}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("circle-covers")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      alert("Gagal upload cover: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("circle-covers").getPublicUrl(path);
    setEditForm((f: any) => ({ ...f, cover_url: data.publicUrl }));
    setUploading(false);
  };

  const handleDelete = async (circle: any) => {
    if (!confirm("Hapus circle ini? Line up dan komentar ikut terhapus.")) return;
    const coverPath = extractStoragePath(circle.cover_url, "circle-covers");
    await supabase.from("circles").delete().eq("id", circle.id);
    if (coverPath) {
      await supabase.storage.from("circle-covers").remove([coverPath]);
    }
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Circle</h1>
        <button onClick={() => setShowChooser(true)} className="bg-primary text-white px-4 py-2 rounded-xl text-sm">
          + Tambah Circle
        </button>
      </div>

      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Kategori</th>
              <th className="p-3">Lokasi</th>
              <th className="p-3">Tanggal</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {circles.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.category}</td>
                <td className="p-3">{c.location}</td>
                <td className="p-3">{new Date(c.event_date).toLocaleDateString("id-ID")}</td>
                <td className="p-3 capitalize">{c.status}</td>
                <td className="p-3 space-x-2">
                  <button onClick={() => openEdit(c)} className="text-primary underline">Edit</button>
                  <button onClick={() => handleDelete(c)} className="text-red-500 underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alur tambah circle - sama seperti user */}
      {showChooser && (
        <ChooseCircleTypeModal
          circlePlusEnabled={circlePlusEnabled}
          onClose={() => setShowChooser(false)}
          onChoose={(type) => {
            setCreateType(type);
            setShowChooser(false);
          }}
        />
      )}
      {createType && (
        <CreateCircleModal
          circleType={createType}
          onClose={() => setCreateType(null)}
          onCreated={load}
        />
      )}

      {/* Modal edit circle (khusus admin) */}
      {editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold">Edit Circle</h2>

            <div className="space-y-1">
              <div className="h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                {editForm.cover_url ? (
                  <img src={editForm.cover_url} alt="cover" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-400 text-sm">Belum ada cover</span>
                )}
              </div>
              <label className="text-sm text-primary font-medium cursor-pointer inline-block">
                {uploading ? "Mengunggah..." : "Upload Cover"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            <input
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Nama Circle"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
            <textarea
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Deskripsi"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
            >
              {["Gowes", "Jalan Santai", "Running"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Domisili"
              value={editForm.city ?? ""}
              onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
            />
            <input
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Titik Kumpul"
              value={editForm.location}
              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
            />
            <input
              type="datetime-local"
              className="w-full border rounded-xl px-3 py-2"
              value={toDateTimeLocalValue(editForm.event_date)}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setEditForm({ ...editForm, event_date: fromDateTimeLocalValue(v) });
              }}
            />
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditForm(null)} className="px-4 py-2 text-gray-500">Batal</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-primary text-white rounded-xl">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
