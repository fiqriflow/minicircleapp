"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X, CheckCheck, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  AppNotification,
  clearAllNotifications,
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markAsRead,
  refreshCompletedCircles,
} from "@/lib/notifications";

const POLL_MS = 15000;

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} jam lalu`;
  const day = Math.floor(hour / 24);
  return `${day} hari lalu`;
}

export default function NotificationProfile() {
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const router = useRouter();

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  const load = async (uid: string) => {
    const data = await getNotifications(supabase, uid);
    setNotifs(data);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await refreshCompletedCircles(supabase); // tutup circle yg waktunya lewat + notif host
      await load(user.id);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(async () => {
      await refreshCompletedCircles(supabase);
      await load(userId);
    }, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    if (!userId) return;
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllAsRead(supabase, userId);
  };

  const handleClearAll = async () => {
    if (!userId) return;
    setNotifs([]);
    await clearAllNotifications(supabase, userId);
  };

  const handleDeleteOne = async (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(supabase, id);
  };

  const handleClickNotif = async (n: AppNotification) => {
    if (!n.is_read) {
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      await markAsRead(supabase, n.id);
    }
    if (n.circle_id) {
      setShowNotif(false);
      router.push(`/circle/${n.circle_id}`);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShowNotif((s) => !s)}
        className="text-gray-500 hover:text-gray-800 relative"
        aria-label="Notifikasi"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showNotif && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Notifikasi</p>
            {notifs.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  <CheckCheck size={13} /> Tandai Dibaca
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-xs text-red-500 font-medium hover:underline"
                >
                  <Trash2 size={13} /> Hapus Semua
                </button>
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y">
            {!notifs.length && (
              <p className="text-sm text-gray-400 px-4 py-6 text-center">Belum ada notifikasi.</p>
            )}
            {notifs.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClickNotif(n)}
                className={`relative flex items-start gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                  !n.is_read ? "bg-primary/5" : ""
                }`}
              >
                {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                <div className={`flex-1 min-w-0 ${n.is_read ? "pl-4" : ""}`}>
                  <p className="text-sm text-gray-700 leading-snug pr-4">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteOne(n.id);
                  }}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-500"
                  aria-label="Hapus notifikasi"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
