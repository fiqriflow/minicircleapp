"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { extractStoragePath } from "@/lib/storagePath";
import { getCirclePlusEnabled } from "@/lib/appSettings";
import ChooseCircleTypeModal from "@/components/ChooseCircleTypeModal";
import CreateCircleModal from "@/components/CreateCircleModal";

export default function AdminCirclePage() {
  const supabase = createClient();
  const [circles, setCircles] = useState<any[]>([]);
  const [editingCircle, setEditingCircle] = useState<any>(null); // circle yang lagi diedit
  const [viewing, setViewing] = useState<any>(null); // circle yang lagi dilihat detailnya
  const [showChooser, setShowChooser] = useState(false);
  const [createType, setCreateType] = useState<"regular" | "plus" | null>(null);
  const [circlePlusEnabled, setCirclePlusEnabled] = useState(true);
  const [onlyNoHost, setOnlyNoHost] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("circles")
      .select("*, host:profiles!circles_created_by_fkey(nickname, full_name)")
      .order("event_date", { ascending: false });
    setCircles(data ?? []);
  };

  useEffect(() => {
    load();
    getCirclePlusEnabled(supabase).then(setCirclePlusEnabled);
  }, []);

  const handleStatusChange = async (circleId: string, status: string) => {
    await supabase.from("circles").update({ status }).eq("id", circleId);
    load();
  };

  const openDetail = async (circle: any) => {
    setViewing({ ...circle, loadingExtra: true });
    const [{ data: host }, { count }] = await Promise.all([
      circle.created_by
        ? supabase.from("admin_player_view").select("full_name, nickname, email").eq("id", circle.created_by).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("circle_members")
        .select("id", { count: "exact", head: true })
        .eq("circle_id", circle.id)
        .eq("status", "joined"),
    ]);
    const hostDeleted = !circle.created_by;
    setViewing({
      ...circle,
      loadingExtra: false,
      hostName: hostDeleted ? "Akun Dihapus" : host?.nickname || host?.full_name || "-",
      hostEmail: hostDeleted ? "-" : host?.email || "-",
      hostDeleted,
      joinedCount: count ?? 0,
    });
  };

  const noHostLabel = (c: any) => !c.created_by;
  const displayedCircles = onlyNoHost ? circles.filter(noHostLabel) : circles;

  const handleDelete = async (circle: any) => {
    if (!confirm("Hapus circle ini? Line up dan komentar ikut terhapus.")) return;
    const coverPath = extractStoragePath(circle.cover_url, "circle-covers");
    await supabase.from("circles").delete().eq("id", circle.id);
    if (coverPath) {
      await supabase.storage.from("circle-covers").remove([coverPath]);
    }
    toast.success("Circle berhasil dihapus.");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-xl font-bold">Circle</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={onlyNoHost}
              onChange={(e) => setOnlyNoHost(e.target.checked)}
            />
            Tampilkan yang tanpa host saja
          </label>
          <button onClick={() => setShowChooser(true)} className="bg-primary text-white px-4 py-2 rounded-xl text-sm">
            + Tambah Circle
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Aktivitas</th>
              <th className="p-3">Host</th>
              <th className="p-3">Lokasi</th>
              <th className="p-3">Tanggal</th>
              <th className="p-3">Status</th>
              <th className="p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {displayedCircles.map((c) => (
              <tr key={c.id} className={`border-t ${!c.created_by ? "bg-red-50" : ""}`}>
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.category}</td>
                <td className="p-3">
                  {c.created_by ? (
                    c.host?.nickname || c.host?.full_name || "-"
                  ) : (
                    <span className="text-red-500 text-xs font-medium bg-red-100 px-2 py-0.5 rounded-full">
                      Akun Dihapus
                    </span>
                  )}
                </td>
                <td className="p-3">{c.location}</td>
                <td className="p-3">{new Date(c.event_date).toLocaleDateString("id-ID")}</td>
                <td className="p-3">
                  <select
                    value={c.status}
                    onChange={(e) => handleStatusChange(c.id, e.target.value)}
                    className="border rounded-lg px-2 py-1 text-xs capitalize"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="p-3 space-x-2 whitespace-nowrap">
                  <button onClick={() => openDetail(c)} className="text-gray-600 underline">Detail</button>
                  <button onClick={() => setEditingCircle(c)} className="text-primary underline">Edit</button>
                  <button onClick={() => handleDelete(c)} className="text-red-500 underline">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail circle - read only, bentuk list */}
      {viewing && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg">{viewing.name}</h2>

            <div className="divide-y border rounded-xl overflow-hidden">
              {[
                ["Kategori", viewing.category || "-"],
                ["Kota", viewing.city || "-"],
                ["Titik Kumpul", viewing.location || "-"],
                [
                  "Tanggal & Jam",
                  viewing.event_date
                    ? new Date(viewing.event_date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }) +
                      " • " +
                      new Date(viewing.event_date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
                    : "-",
                ],
                ["Status", viewing.status],
                [
                  "Slot Terisi",
                  viewing.loadingExtra
                    ? "Memuat..."
                    : `${viewing.joinedCount}/${viewing.max_participants ?? "-"}`,
                ],
                [
                  "Dibuat oleh",
                  viewing.loadingExtra ? (
                    "Memuat..."
                  ) : viewing.hostDeleted ? (
                    <span className="text-red-500">Akun Dihapus</span>
                  ) : (
                    viewing.hostName
                  ),
                ],
                ["Email Pembuat", viewing.loadingExtra ? "Memuat..." : viewing.hostEmail],
                ["Grup", viewing.group_name || "-"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>

            {viewing.description && (
              <div>
                <p className="font-semibold mb-1 text-sm">Deskripsi</p>
                <p className="text-gray-500 text-sm">{viewing.description}</p>
              </div>
            )}

            <button onClick={() => setViewing(null)} className="w-full border rounded-xl py-3 font-medium text-gray-500">
              Tutup
            </button>
          </div>
        </div>
      )}

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

      {/* Edit circle - form sama persis dengan form Create Circle */}
      {editingCircle && (
        <CreateCircleModal
          editCircle={editingCircle}
          onClose={() => setEditingCircle(null)}
          onCreated={load}
        />
      )}
    </div>
  );
}
