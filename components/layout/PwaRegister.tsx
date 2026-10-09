"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush, isPushOptedOut } from "@/lib/push";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    // Izin notif TIDAK diminta di sini (iOS wajib gesture user; Chrome bisa auto-blok).
    // User mengaktifkannya lewat tombol di menu Profil. Di sini hanya sinkron diam-diam
    // kalau izin sudah granted dan user belum mematikan notif di device ini.
    const syncPush = () => {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      if (isPushOptedOut()) return;
      subscribeToPush().catch(() => {});
    };

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("SW registration failed:", err);
    });

    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) syncPush();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") syncPush();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
