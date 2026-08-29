"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const emptyForm = {
  name: "",
  description: "",
  category: "Gowes",
  location: "",
  event_date: "",
  status: "active",
};

export default function AdminCirclePage() {
  const supabase = createClient();
  const [circles, setCircles] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null); // null = modal closed
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("circles").select("*").order("event_date", { ascending: false });
    setCircles(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => setForm({ ...emptyForm });
  const openEdit = (c: any) => setForm({ ...c });

  const handleSave = async () => {
    if (form.id) {
      await supabase.from("circles").update(form).eq("id", form.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("circles").insert({ ...form, created_by: user?.id });
    }
    setForm(null);
    load();
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${form.id ?? "new"}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("circle-covers")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      alert("Gagal upload cover: " + uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("circle-covers").getPublicUrl(path);
    setForm((f: any) => ({ ...f, cover_url: data.publicUrl }));
    setUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus circle ini?")) return;
    await supabase.from("circles").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Circle</h1>
        <button onClick={openCreate} className="bg-primary text-white px-4 py-2 rounded-xl text-sm">
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
                  <button onClick={() => handleDelete(c.id)} className="text-red-500 underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold">{form.id ? "Edit Circle" : "Tambah Circle"}</h2>

            <div className="space-y-1">
              <div className="h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                {form.cover_url ? (
                  <img src={form.cover_url} alt="cover" className="w-full h-full object-cover" />
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
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <textarea
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Deskripsi"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {["Gowes", "Jalan Santai", "Running", "Lainnya"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              className="w-full border rounded-xl px-3 py-2"
              placeholder="Lokasi"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <input
              type="datetime-local"
              className="w-full border rounded-xl px-3 py-2"
              value={form.event_date?.slice(0, 16) ?? ""}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            />
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setForm(null)} className="px-4 py-2 text-gray-500">Batal</button>
              <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
