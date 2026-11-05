"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, CheckCheck, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { optimistic } from "@/lib/optimistic";
import {
  AppNotification,
  clearAllNotifications,
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markAsRead,
  notifyNotificationsChanged,
} from "@/lib/notifications";

const POLL_MS = 45000;

function timeAgo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  return `${Math.floor(hour / 24)} hari lalu`;
}

export default function NotificationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [notifs, setNotifs] = useState<AppNotification[] | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = async (uid: string) => setNotifs(await getNotifications(supabase, uid));

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await load(user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    const tick = () => {
      if (!document.hidden) load(userId);
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const list = notifs ?? [];
  const unreadCount = list.filter((n) => !n.is_read).length;
  const shown = filter === "unread" ? list.filter((n) => !n.is_read) : list;

  // OPTIMISTIC: tampilan langsung berubah; gagal -> dikembalikan + toast
  const handleMarkAllRead = async () => {
    if (!userId) return;
    const prev = list;
    await optimistic({
      apply: () => {
        setNotifs((p) => (p ?? []).map((n) => ({ ...n, is_read: true })));
        return () => setNotifs(prev);
      },
      run: () => markAllAsRead(supabase, userId),
      onSettled: notifyNotificationsChanged,
      errorMessage: () => "Gagal menandai dibaca.",
    });
  };

  const handleClearAll = async () => {
    if (!userId) return;
    const prev = list;
    await optimistic({
      apply: () => {
        setNotifs([]);
        return () => setNotifs(prev);
      },
      run: () => clearAllNotifications(supabase, userId),
      onSettled: notifyNotificationsChanged,
      errorMessage: () => "Gagal menghapus notifikasi.",
    });
  };

  const handleDeleteOne = async (id: string) => {
    const prev = list;
    await optimistic({
      apply: () => {
        setNotifs((p) => (p ?? []).filter((n) => n.id !== id));
        return () => setNotifs(prev);
      },
      run: () => deleteNotification(supabase, id),
      onSettled: notifyNotificationsChanged,
      errorMessage: () => "Gagal menghapus notifikasi.",
    });
  };

  const handleClickNotif = async (n: AppNotification) => {
    if (n.circle_id) router.push(`/circle/${n.circle_id}`); // pindah dulu, status baca disimpan di belakang
    if (!n.is_read) {
      const prev = list;
      await optimistic({
        apply: () => {
          setNotifs((p) => (p ?? []).map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
          return () => setNotifs(prev);
        },
        run: () => markAsRead(supabase, n.id),
        onSettled: notifyNotificationsChanged,
        onError: () => true, // gagal tandai baca bukan masalah besar: tanpa toast
      });
    }
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-white border-b flex items-center gap-3 px-4 py-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800" aria-label="Kembali">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold flex-1">Notifikasi</h1>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">{unreadCount}</span>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-xl border-2 text-xs font-bold ${
                  filter === f ? "text-primary bg-primary/10 border-primary" : "text-gray-400 border-gray-200"
                }`}
              >
                {f === "all" ? "Semua" : "Belum dibaca"}
              </button>
            ))}
          </div>
          {list.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="btn-flat flex items-center gap-1 text-xs text-primary font-medium disabled:opacity-40"
              >
                <CheckCheck size={14} /> Tandai Dibaca
              </button>
              <button
                onClick={handleClearAll}
                className="btn-flat flex items-center gap-1 text-xs text-red-500 font-medium"
              >
                <Trash2 size={14} /> Hapus Semua
              </button>
            </div>
          )}
        </div>

        {notifs === null ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
            <Bell size={36} />
            <p className="text-sm">{filter === "unread" ? "Semua sudah dibaca." : "Belum ada notifikasi."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {shown.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClickNotif(n)}
                className={`relative flex items-start gap-2 p-3 pr-8 rounded-2xl border cursor-pointer hover:bg-gray-50 ${
                  !n.is_read ? "bg-primary/5" : "bg-white"
                }`}
              >
                {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-snug">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteOne(n.id);
                  }}
                  className="btn-flat absolute top-2 right-2 text-gray-300 hover:text-red-500"
                  aria-label="Hapus notifikasi"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
