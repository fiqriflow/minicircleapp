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

  const handleStatusChange = async (circleId: string, status: string) => {
    await supabase.from("circles").update({ status }).eq("id", circleId);
    load();
  };

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
                <td className="p-3 space-x-2">
                  <button onClick={() => setEditingCircle(c)} className="text-primary underline">Edit</button>
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
