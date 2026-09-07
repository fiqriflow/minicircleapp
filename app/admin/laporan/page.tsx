"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: "Baru", className: "bg-amber-100 text-amber-700" },
  reviewed: { label: "Ditinjau", className: "bg-blue-100 text-blue-700" },
  resolved: { label: "Ditindaklanjuti", className: "bg-green-100 text-green-700" },
  dismissed: { label: "Ditolak", className: "bg-gray-100 text-gray-500" },
};

const STATUS_FILTERS = [
  { value: "all", label: "Semua" },
  { value: "pending", label: "Baru" },
  { value: "reviewed", label: "Ditinjau" },
  { value: "resolved", label: "Ditindaklanjuti" },
  { value: "dismissed", label: "Ditolak" },
];

export default function AdminLaporanPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterType, setFilterType] = useState<"all" | "circle" | "user">("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("reports")
      .select(
        "*, reporter:profiles!reports_reporter_id_fkey(full_name, nickname), target_circle:circles(id, name), target_user:profiles!reports_target_user_id_fkey(id, full_name, nickname)"
      )
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setSavingId(id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("reports")
      .update({ status, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("Gagal memperbarui status: " + error.message);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    toast.success("Status laporan diperbarui.");
  };

  const filtered = items.filter((i) => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterType !== "all" && i.target_type !== filterType) return false;
    return true;
  });

  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Flag size={20} /> Laporan
        </h1>
        <p className="text-sm text-gray-400">
          Laporan Circle dan Pengguna yang dikirim user. {pendingCount > 0 && `${pendingCount} laporan baru belum ditinjau.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                filterStatus === f.value ? "bg-primary text-white border-primary" : "text-gray-500"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap ml-auto">
          {[
            { value: "all", label: "Semua Tipe" },
            { value: "circle", label: "Circle" },
            { value: "user", label: "Pengguna" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterType(f.value as any)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                filterType === f.value ? "bg-gray-800 text-white border-gray-800" : "text-gray-500"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">Tidak ada laporan.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const status = STATUS_LABEL[item.status] ?? STATUS_LABEL.pending;
            const reporterName = item.reporter?.nickname || item.reporter?.full_name || "User terhapus";
            const targetName =
              item.target_type === "circle"
                ? item.target_circle?.name || "Circle terhapus"
                : item.target_user?.nickname || item.target_user?.full_name || "Akun terhapus";
            const targetHref =
              item.target_type === "circle" && item.target_circle
                ? `/circle/${item.target_circle.id}`
                : item.target_type === "user" && item.target_user
                ? `/admin/player`
                : null;

            return (
              <div key={item.id} className="bg-white rounded-2xl border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="text-xs font-medium bg-gray-50 text-gray-500 px-2 py-1 rounded-full border">
                      {item.target_type === "circle" ? "Circle" : "Pengguna"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString("id-ID")}
                  </span>
                </div>

                <div className="text-sm">
                  <p>
                    Dilaporkan oleh <span className="font-medium">{reporterName}</span> — target:{" "}
                    {targetHref ? (
                      <Link href={targetHref} className="font-medium text-primary inline-flex items-center gap-1">
                        {targetName} <ExternalLink size={12} />
                      </Link>
                    ) : (
                      <span className="font-medium">{targetName}</span>
                    )}
                  </p>
                  <p className="text-gray-600 mt-1">
                    <span className="font-medium">Alasan:</span> {item.reason}
                  </p>
                  {item.description && <p className="text-gray-500 mt-1">{item.description}</p>}
                </div>

                {item.status !== "resolved" && item.status !== "dismissed" && (
                  <div className="flex gap-2 pt-1 flex-wrap">
                    {item.status === "pending" && (
                      <button
                        onClick={() => updateStatus(item.id, "reviewed")}
                        disabled={savingId === item.id}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border text-blue-600 border-blue-200 hover:bg-blue-50 disabled:opacity-50"
                      >
                        Tandai Ditinjau
                      </button>
                    )}
                    <button
                      onClick={() => updateStatus(item.id, "resolved")}
                      disabled={savingId === item.id}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border text-green-600 border-green-200 hover:bg-green-50 disabled:opacity-50"
                    >
                      Tandai Ditindaklanjuti
                    </button>
                    <button
                      onClick={() => updateStatus(item.id, "dismissed")}
                      disabled={savingId === item.id}
                      className="text-xs font-medium px-3 py-1.5 rounded-full border text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Tolak Laporan
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
