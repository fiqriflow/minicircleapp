"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import LocationInput from "@/components/LocationInput";

const CATEGORY_OPTIONS = ["Gowes", "Jalan Santai", "Running"];

export default function AdminPlayerPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setPlayers(data ?? []);
  };

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const handleSave = async () => {
    const { id, created_at, ...fields } = editing;
    const { error } = await supabase.from("profiles").update(fields).eq("id", id);
    if (error) {
      alert("Gagal simpan perubahan: " + error.message);
      return;
    }
    setEditing(null);
    toast.success("Perubahan player berhasil disimpan!");
    load();
  };

  const handleDelete = async (player: any) => {
    if (player.id === currentUserId) {
      alert("Kamu tidak bisa menghapus akunmu sendiri.");
      return;
    }
    if (
      !confirm(
        `Hapus data player "${player.full_name || player.nickname || player.id}"?\n\n` +
          "Profil, keikutsertaan di circle, dan komentarnya akan ikut terhapus. " +
          "Circle yang pernah dia buat tetap ada (host-nya jadi kosong). " +
          "Akun login (email/password) tidak ikut terhapus dari sistem autentikasi."
      )
    )
      return;
    const { error } = await supabase.from("profiles").delete().eq("id", player.id);
    if (error) {
      alert("Gagal hapus user: " + error.message);
      return;
    }
    toast.success("Player berhasil dihapus.");
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Player</h1>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {players.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border p-4 space-y-2">
            <div className="flex items-center gap-3">
              <img
                src={p.avatar_url || "https://ui-avatars.com/api/?name=" + (p.full_name || "U")}
                alt=""
                className="w-12 h-12 rounded-full object-cover border"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.full_name || "-"}</p>
                <p className="text-sm text-gray-500 truncate">{p.nickname || "-"}</p>
              </div>
              {p.is_super_admin && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full shrink-0">Admin</span>
              )}
            </div>
            <div className="text-sm text-gray-500 grid grid-cols-2 gap-1">
              <span>📍 {p.location || "-"}</span>
              <span>⚧ {p.gender || "-"}</span>
            </div>
            <div className="flex gap-4 pt-1 border-t text-sm">
              <button onClick={() => setEditing(p)} className="text-primary font-medium py-2">Edit</button>
              <button onClick={() => handleDelete(p)} className="text-red-500 font-medium py-2">Hapus</button>
            </div>
          </div>
        ))}
        {!players.length && <p className="text-gray-400 text-sm">Belum ada player.</p>}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Panggilan</th>
              <th className="p-3">Lokasi</th>
              <th className="p-3">Gender</th>
              <th className="p-3">Admin</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.full_name}</td>
                <td className="p-3">{p.nickname}</td>
                <td className="p-3">{p.location}</td>
                <td className="p-3">{p.gender}</td>
                <td className="p-3">{p.is_super_admin ? "✅" : "-"}</td>
                <td className="p-3 space-x-2">
                  <button onClick={() => setEditing(p)} className="text-primary underline">Edit</button>
                  <button onClick={() => handleDelete(p)} className="text-red-500 underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg">Edit Player</h2>

            <div>
              <label className="text-sm text-gray-500">Nama Lengkap</label>
              <input
                className="w-full border rounded-xl px-4 py-2"
                value={editing.full_name ?? ""}
                onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Nama Panggilan</label>
              <input
                className="w-full border rounded-xl px-4 py-2"
                value={editing.nickname ?? ""}
                onChange={(e) => setEditing({ ...editing, nickname: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Tanggal Lahir</label>
              <input
                type="date"
                className="w-full border rounded-xl px-4 py-2"
                value={editing.birth_date ?? ""}
                onChange={(e) => setEditing({ ...editing, birth_date: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Kategori Disukai</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {CATEGORY_OPTIONS.map((cat) => {
                  const active = editing.categories?.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setEditing((p: any) => {
                          const current: string[] = p.categories ?? [];
                          const next = current.includes(cat) ? current.filter((c) => c !== cat) : [...current, cat];
                          return { ...p, categories: next };
                        })
                      }
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
                id="admin-player-city-list"
                value={editing.location ?? ""}
                onChange={(v) => setEditing({ ...editing, location: v })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Gender</label>
              <select
                className="w-full border rounded-xl px-4 py-2"
                value={editing.gender ?? ""}
                onChange={(e) => setEditing({ ...editing, gender: e.target.value })}
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
                value={editing.instagram ?? ""}
                onChange={(e) => setEditing({ ...editing, instagram: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm border-t pt-3">
              <input
                type="checkbox"
                checked={!!editing.is_super_admin}
                onChange={(e) => setEditing({ ...editing, is_super_admin: e.target.checked })}
              />
              Jadikan Super Admin
            </label>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 border rounded-xl py-3 font-medium text-gray-500">
                Batal
              </button>
              <button onClick={handleSave} className="flex-1 bg-primary text-white rounded-xl py-3 font-medium">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
