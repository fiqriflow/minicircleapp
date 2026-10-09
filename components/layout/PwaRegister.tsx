"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush } from "@/lib/push";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let tapHandler: (() => void) | null = null;

    const clearTap = () => {
      if (tapHandler) {
        window.removeEventListener("pointerup", tapHandler);
        tapHandler = null;
      }
    };

    // Izin notif TIDAK diminta otomatis saat load: iOS (PWA) mewajibkan gesture user,
    // dan Chrome bisa auto-blokir permanen kalau prompt sering diabaikan.
    // - granted  -> sinkron diam-diam (subscription bisa berganti/hilang)
    // - default  -> tunggu tap pertama user, baru minta izin
    // - denied   -> diam
    const syncPush = () => {
      if (!("Notification" in window)) return;
      const perm = Notification.permission;
      if (perm === "denied") return;
      if (perm === "granted") {
        subscribeToPush().catch(() => {});
        return;
      }
      if (tapHandler) return;
      tapHandler = () => {
        clearTap();
        subscribeToPush().catch(() => {});
      };
      window.addEventListener("pointerup", tapHandler, { once: true });
    };

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("SW registration failed:", err);
    });

    const supabase = createClient();

    // Kalau component ini mount pas user UDAH login (misal reload halaman while logged in)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) syncPush();
    });

    // Kalau user baru aja login TANPA reload halaman penuh (client-side redirect),
    // window "load" udah lama kepanggil duluan, jadi dengerin auth state langsung.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") syncPush();
      if (event === "SIGNED_OUT") clearTap();
    });

    return () => {
      cancelled = true;
      clearTap();
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
