"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import LocationInput from "@/components/LocationInput";

const CATEGORY_OPTIONS = ["Gowes", "Jalan Santai", "Jogging", "Kulineran", "Ngopi", "Explore Alam"];

const GENDER_LABEL: Record<string, string> = { male: "Pria", female: "Wanita" };

export default function AdminPlayerPage() {
  const supabase = createClient();
  const [players, setPlayers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("admin_player_view")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Gagal memuat data player: " + error.message);
      return;
    }
    setPlayers(data ?? []);
  };

  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const handleSave = async () => {
    const { id, created_at, email, ...fields } = editing;
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
        `Hapus data player "${player.full_name || player.nickname || player.id}" (Soft Delete)?\n\n` +
          "Profil, keikutsertaan di circle, dan komentarnya akan ikut terhapus. " +
          "Circle yang pernah dia buat tetap ada (host-nya jadi kosong). " +
          "Akun Google-nya TIDAK ikut terhapus — kalau dia login lagi pakai akun yang sama, " +
          "dia akan diarahkan isi ulang data dari awal seperti daftar baru."
      )
    )
      return;
    const { error } = await supabase.from("profiles").delete().eq("id", player.id);
    if (error) {
      alert("Gagal hapus user: " + error.message);
      return;
    }
    toast.success("Player berhasil dihapus (soft delete).");
    load();
  };

  const handleHardDelete = async (player: any) => {
    if (player.id === currentUserId) {
      alert("Kamu tidak bisa menghapus akunmu sendiri.");
      return;
    }
    if (
      !confirm(
        `HAPUS PERMANEN akun "${player.full_name || player.nickname || player.id}"?\n\n` +
          "Ini menghapus profil DAN akun Google-nya sekaligus dari sistem autentikasi. " +
          "Emailnya akan benar-benar bersih, seolah belum pernah daftar sama sekali. " +
          "AKSI INI TIDAK BISA DIBATALKAN."
      )
    )
      return;
    const confirmText = prompt('Ketik "HAPUS" untuk konfirmasi hapus permanen:');
    if (confirmText !== "HAPUS") {
      if (confirmText !== null) alert("Konfirmasi tidak sesuai, dibatalkan.");
      return;
    }
    const res = await fetch("/api/admin/hard-delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: player.id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert("Gagal hapus permanen: " + (json.error || res.statusText));
      return;
    }
    toast.success("Akun berhasil dihapus permanen.");
    load();
  };

  const handleSuspendTemporary = async (player: any) => {
    if (player.id === currentUserId) {
      alert("Kamu tidak bisa menonaktifkan akunmu sendiri.");
      return;
    }
    const daysInput = prompt(
      `Nonaktifkan sementara "${player.full_name || player.nickname}" selama berapa hari?`,
      "7"
    );
    if (!daysInput) return;
    const days = Number(daysInput);
    if (!Number.isFinite(days) || days <= 0) {
      alert("Jumlah hari tidak valid.");
      return;
    }
    const reason = prompt("Alasan penonaktifan (opsional):", "") ?? "";
    const suspendedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ suspended_until: suspendedUntil, is_banned: false, suspension_reason: reason || null })
      .eq("id", player.id);
    if (error) {
      alert("Gagal menonaktifkan user: " + error.message);
      return;
    }
    toast.success(`Akun dinonaktifkan sementara selama ${days} hari.`);
    load();
  };

  const handleSuspendPermanent = async (player: any) => {
    if (player.id === currentUserId) {
      alert("Kamu tidak bisa menonaktifkan akunmu sendiri.");
      return;
    }
    if (!confirm(`Nonaktifkan PERMANEN akun "${player.full_name || player.nickname}"? Aksi ini bisa dibatalkan lagi lewat "Aktifkan Kembali".`))
      return;
    const reason = prompt("Alasan penonaktifan permanen (opsional):", "") ?? "";
    const { error } = await supabase
      .from("profiles")
      .update({ is_banned: true, suspended_until: null, suspension_reason: reason || null })
      .eq("id", player.id);
    if (error) {
      alert("Gagal menonaktifkan user: " + error.message);
      return;
    }
    toast.success("Akun dinonaktifkan permanen.");
    load();
  };

  const handleReactivate = async (player: any) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_banned: false, suspended_until: null, suspension_reason: null })
      .eq("id", player.id);
    if (error) {
      alert("Gagal mengaktifkan kembali user: " + error.message);
      return;
    }
    toast.success("Akun diaktifkan kembali.");
    load();
  };

  const getStatus = (p: any): { label: string; className: string } => {
    if (p.is_banned) return { label: "Banned", className: "bg-red-50 text-red-600" };
    if (p.suspended_until && new Date(p.suspended_until) > new Date())
      return { label: "Suspended", className: "bg-yellow-50 text-yellow-700" };
    return { label: "Aktif", className: "bg-green-50 text-green-600" };
  };

  const displayedPlayers = players.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [p.full_name, p.nickname, p.email, p.location, p.instagram]
      .filter(Boolean)
      .some((v: string) => v.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-xl font-bold">Player</h1>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, email, lokasi..."
          className="border rounded-xl px-3 py-2 text-sm w-56"
        />
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {displayedPlayers.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border p-4 space-y-2">
            <div className="flex items-center gap-3">
              <img
                src={p.avatar_url || "https://ui-avatars.com/api/?name=" + (p.full_name || "U")}
                alt=""
                className="w-12 h-12 rounded-full object-cover border"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{p.full_name || "-"}</p>
                <p className="text-sm text-gray-500 truncate">{p.email || "-"}</p>
              </div>
              {p.is_super_admin && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full shrink-0">Admin</span>
              )}
              <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${getStatus(p).className}`}>
                {getStatus(p).label}
              </span>
            </div>
            <div className="text-sm text-gray-500 grid grid-cols-2 gap-1">
              <span>📍 {p.location || "-"}</span>
              <span>⚧ {GENDER_LABEL[p.gender] || "-"}</span>
            </div>
            <div className="flex gap-4 pt-1 border-t text-sm flex-wrap">
              <button onClick={() => setViewing(p)} className="text-gray-600 font-medium py-2">Detail</button>
              <button onClick={() => setEditing(p)} className="text-primary font-medium py-2">Edit</button>
              {p.is_banned || (p.suspended_until && new Date(p.suspended_until) > new Date()) ? (
                <button onClick={() => handleReactivate(p)} className="text-green-600 font-medium py-2">Aktifkan Kembali</button>
              ) : (
                <>
                  <button onClick={() => handleSuspendTemporary(p)} className="text-yellow-600 font-medium py-2">Nonaktifkan Sementara</button>
                  <button onClick={() => handleSuspendPermanent(p)} className="text-red-600 font-medium py-2">Nonaktifkan Permanen</button>
                </>
              )}
              <button onClick={() => handleDelete(p)} className="text-red-500 font-medium py-2">Hapus (Soft)</button>
              <button onClick={() => handleHardDelete(p)} className="text-red-700 font-bold py-2">Hapus Permanen</button>
            </div>
          </div>
        ))}
        {!displayedPlayers.length && <p className="text-gray-400 text-sm">{search ? "Tidak ada player yang cocok." : "Belum ada player."}</p>}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Panggilan</th>
              <th className="p-3">Email</th>
              <th className="p-3">Lokasi</th>
              <th className="p-3">Gender</th>
              <th className="p-3">Admin</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {displayedPlayers.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.full_name}</td>
                <td className="p-3">{p.nickname}</td>
                <td className="p-3">{p.email}</td>
                <td className="p-3">{p.location}</td>
                <td className="p-3">{GENDER_LABEL[p.gender] || "-"}</td>
                <td className="p-3">{p.is_super_admin ? "✅" : "-"}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatus(p).className}`}>{getStatus(p).label}</span>
                </td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  <button onClick={() => setViewing(p)} className="text-gray-600 underline">Detail</button>
                  <button onClick={() => setEditing(p)} className="text-primary underline">Edit</button>
                  {p.is_banned || (p.suspended_until && new Date(p.suspended_until) > new Date()) ? (
                    <button onClick={() => handleReactivate(p)} className="text-green-600 underline">Aktifkan Kembali</button>
                  ) : (
                    <>
                      <button onClick={() => handleSuspendTemporary(p)} className="text-yellow-600 underline">Suspend</button>
                      <button onClick={() => handleSuspendPermanent(p)} className="text-red-600 underline">Ban</button>
                    </>
                  )}
                  <button onClick={() => handleDelete(p)} className="text-red-500 underline">Hapus (Soft)</button>
                  <button onClick={() => handleHardDelete(p)} className="text-red-700 underline font-bold">Hapus Permanen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: View Detail (read-only, bentuk list c) */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <img
                src={viewing.avatar_url || "https://ui-avatars.com/api/?name=" + (viewing.full_name || "U")}
                alt=""
                className="w-14 h-14 rounded-full object-cover border"
              />
              <div>
                <h2 className="font-bold text-lg">{viewing.full_name || "-"}</h2>
                <p className="text-sm text-gray-500">{viewing.nickname || "-"}</p>
              </div>
            </div>

            <div className="divide-y border rounded-xl overflow-hidden">
              {[
                ["Email", viewing.email || "-"],
                ["Tanggal Lahir", viewing.birth_date || "-"],
                ["Gender", GENDER_LABEL[viewing.gender] || "-"],
                ["Lokasi / Domisili", viewing.location || "-"],
                ["Instagram", viewing.instagram || "-"],
                ["Aktivitas Disukai", viewing.categories?.length ? viewing.categories.join(", ") : "-"],
                ["Super Admin", viewing.is_super_admin ? "Ya" : "Tidak"],
                ["Status", getStatus(viewing).label + (viewing.suspension_reason ? ` — ${viewing.suspension_reason}` : "")],
                [
                  "Terdaftar",
                  viewing.created_at
                    ? new Date(viewing.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "-",
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setViewing(null)} className="w-full border rounded-xl py-3 font-medium text-gray-500">
              Tutup
            </button>
          </div>
        </div>
      )}

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
              <label className="text-sm text-gray-500">Aktivitas Disukai</label>
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
                <option value="male">Pria</option>
                <option value="female">Wanita</option>
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
              {editing.instagram && !editing.instagram.startsWith("@") && (
                <p className="text-xs text-red-500 mt-1">Harus diawali dengan @, contoh: @username</p>
              )}
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
              <button
                onClick={handleSave}
                disabled={editing.instagram && !editing.instagram.startsWith("@")}
                className="flex-1 bg-primary text-white rounded-xl py-3 font-medium disabled:opacity-40"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
