"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  circle_created: { label: "Circle Dibuat", className: "bg-blue-50 text-blue-600" },
  user_registered: { label: "User Baru", className: "bg-green-50 text-green-600" },
  account_deleted: { label: "Akun Dihapus", className: "bg-red-50 text-red-600" },
};

export default function AdminLogPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setItems(data ?? []);
    setSelected([]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filterType === "all" ? items : items.filter((i) => i.type === filterType);

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelected(selected.length === filtered.length ? [] : filtered.map((i) => i.id));
  };

  const handleDeleteOne = async (id: string) => {
    if (!confirm("Hapus log ini? Tidak bisa dikembalikan.")) return;
    const { error } = await supabase.from("activity_log").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus: " + error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => prev.filter((i) => i !== id));
    toast.success("Log dihapus.");
  };

  const handleDeleteSelected = async () => {
    if (!selected.length) return;
    if (!confirm(`Hapus ${selected.length} log terpilih? Tidak bisa dikembalikan.`)) return;
    const { error } = await supabase.from("activity_log").delete().in("id", selected);
    if (error) {
      toast.error("Gagal menghapus: " + error.message);
      return;
    }
    toast.success("Log terpilih berhasil dihapus.");
    load();
  };

  const handleDeleteAll = async () => {
    if (!items.length) return;
    if (!confirm("Hapus SEMUA log aktivitas? Tindakan ini tidak bisa dikembalikan.")) return;
    const { error } = await supabase
      .from("activity_log")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast.error("Gagal menghapus: " + error.message);
      return;
    }
    toast.success("Semua log berhasil dihapus.");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Log History</h1>
          <p className="text-sm text-gray-400">
            Riwayat aktivitas: circle dibuat, user baru daftar, dan akun yang dihapus.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDeleteSelected}
            disabled={!selected.length}
            className="text-sm font-medium px-3 py-2 rounded-lg border text-red-600 disabled:text-gray-300 disabled:border-gray-200"
          >
            Hapus Terpilih ({selected.length})
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={!items.length}
            className="text-sm font-medium px-3 py-2 rounded-lg bg-red-500 text-white disabled:bg-gray-200"
          >
            Hapus Semua
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "Semua" },
          { value: "circle_created", label: "Circle Dibuat" },
          { value: "user_registered", label: "User Baru" },
          { value: "account_deleted", label: "Akun Dihapus" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterType(f.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
              filterType === f.value ? "bg-primary text-white border-primary" : "text-gray-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">Belum ada log aktivitas.</p>
      ) : (
        <div className="bg-white border rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.length === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="p-3 whitespace-nowrap">Waktu</th>
                <th className="p-3">Tipe</th>
                <th className="p-3">Nama</th>
                <th className="p-3">Email</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const type = TYPE_LABEL[item.type] ?? { label: item.type, className: "bg-gray-100 text-gray-500" };
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap text-gray-400">
                      {new Date(item.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${type.className}`}>
                        {type.label}
                      </span>
                    </td>
                    <td className="p-3">{item.actor_name || "-"}</td>
                    <td className="p-3 text-gray-500">{item.actor_email || "-"}</td>
                    <td className="p-3 text-gray-600">{item.description}</td>
                    <td className="p-3">
                      <button
                        onClick={() => handleDeleteOne(item.id)}
                        className="text-gray-300 hover:text-red-500"
                        aria-label="Hapus log"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
