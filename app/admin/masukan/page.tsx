"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const CATEGORY_LABEL: Record<string, { label: string; className: string }> = {
  bug: { label: "Bug/Error", className: "bg-red-50 text-red-600" },
  feature: { label: "Fitur Diinginkan", className: "bg-blue-50 text-blue-600" },
  other: { label: "Lainnya", className: "bg-gray-100 text-gray-500" },
};

const SOURCE_LABEL: Record<string, string> = {
  masukan: "Menu Masukan",
  circle_plus_coming_soon: "Segera Hadir (Circle+)",
};

export default function AdminMasukanPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const load = async () => {
    const { data } = await supabase
      .from("feedback")
      .select("*, profile:profiles(full_name, avatar_url)")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus masukan ini? Tidak bisa dikembalikan.")) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    const { error } = await supabase.from("feedback").delete().eq("id", id);
    if (error) {
      toast.error("Gagal menghapus: " + error.message);
      load();
      return;
    }
    toast.success("Masukan dihapus.");
  };

  const filtered = filterCategory === "all" ? items : items.filter((i) => i.category === filterCategory);

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Masukan</h1>
        <p className="text-sm text-gray-400">
          Masukan, saran, dan kendala yang dikirim user lewat menu Akun maupun halaman Segera Hadir Circle+.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "Semua" },
          { value: "bug", label: "Bug/Error" },
          { value: "feature", label: "Fitur Diinginkan" },
          { value: "other", label: "Lainnya" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilterCategory(f.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
              filterCategory === f.value ? "bg-primary text-white border-primary" : "text-gray-500"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">Belum ada masukan.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const cat = CATEGORY_LABEL[item.category] ?? CATEGORY_LABEL.other;
            return (
              <div key={item.id} className="bg-white rounded-2xl border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{item.profile?.full_name || "User"}</span>
                    {item.is_anonymous && (
                      <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                        Anonim (ke user lain)
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${cat.className}`}>
                      {cat.label}
                    </span>
                    <span className="text-xs font-medium bg-gray-50 text-gray-400 px-2 py-1 rounded-full border">
                      {SOURCE_LABEL[item.source] ?? item.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString("id-ID")}
                    </span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-300 hover:text-red-500"
                      aria-label="Hapus masukan"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{item.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
