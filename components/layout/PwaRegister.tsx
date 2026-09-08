"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { subscribeToPush } from "@/lib/push";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("SW registration failed:", err);
    });

    const supabase = createClient();

    // Kalau component ini mount pas user UDAH login (misal reload halaman while logged in)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) subscribeToPush().catch(() => {});
    });

    // Kalau user baru aja login TANPA reload halaman penuh (client-side redirect),
    // window "load" udah lama kepanggil duluan, jadi dengerin auth state langsung.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        subscribeToPush().catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
