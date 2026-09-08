"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush } from "@/lib/push";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch (err) {
        console.error("SW registration failed:", err);
        return;
      }

      // Cuma tawarin push notif kalau user udah login.
      // Kalau user belum kasih izin (default), request sekali di sini;
      // kalau udah pernah ditolak, browser gak akan nanya lagi (aman, silent).
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        subscribeToPush().catch(() => {});
      }
    });
  }, []);

  return null;
}
