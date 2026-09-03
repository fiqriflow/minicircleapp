"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminMasukanPage() {
  const supabase = createClient();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("feedback")
        .select("*, profile:profiles(full_name, avatar_url)")
        .order("created_at", { ascending: false });
      setItems(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Masukan</h1>
        <p className="text-sm text-gray-400">Masukan, saran, dan kendala yang dikirim user lewat menu Akun.</p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Memuat...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-sm">Belum ada masukan.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{item.profile?.full_name || "User"}</span>
                  {item.is_anonymous && (
                    <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                      Anonim (ke user lain)
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(item.created_at).toLocaleString("id-ID")}
                </span>
              </div>
              <p className="text-sm text-gray-600">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
