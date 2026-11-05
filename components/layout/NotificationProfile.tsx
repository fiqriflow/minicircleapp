"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getUnreadCount, NOTIF_CHANGED_EVENT, refreshFinishReminders } from "@/lib/notifications";

const POLL_MS = 45000; // polling jumlah belum dibaca; penutupan circle dilakukan pg_cron (0037)

// Lonceng di header: cuma badge jumlah belum dibaca, klik -> halaman /notifications
export default function NotificationProfile() {
  const [unread, setUnread] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    let uid: string | null = null;
    const load = async () => {
      if (!uid) return;
      setUnread(await getUnreadCount(supabase, uid));
    };
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      uid = user.id;
      await refreshFinishReminders(supabase); // pengingat ke host yg lupa tandai selesai
      await load();
    };
    init();

    const tick = () => {
      if (!document.hidden) load();
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener(NOTIF_CHANGED_EVENT, load);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener(NOTIF_CHANGED_EVENT, load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link href="/notifications" prefetch className="text-gray-500 hover:text-gray-800 relative" aria-label="Notifikasi">
      <Bell size={22} />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
