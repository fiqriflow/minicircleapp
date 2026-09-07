"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/login";

  // FIX: di PWA (standalone) iOS/Android, tinggi viewport (dvh) kadang telat
  // ke-kalkulasi pas pertama load — bikin frame lebih tinggi dari layar asli,
  // jadi bottom nav "kedorong" ke bawah (gak sticky) sampai user scroll
  // (yang tanpa sengaja trigger reflow & benerin tingginya).
  // Solusi: paksa hitung ulang tinggi asli pakai window.innerHeight /
  // visualViewport, simpan ke CSS var, lalu dipakai gantiin h-dvh.
  useEffect(() => {
    const setAppHeight = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${h}px`);
    };

    setAppHeight();
    // Jaga-jaga race condition pas PWA baru dibuka dari home screen
    requestAnimationFrame(setAppHeight);
    const t = setTimeout(setAppHeight, 300);

    window.addEventListener("resize", setAppHeight);
    window.addEventListener("orientationchange", setAppHeight);
    window.visualViewport?.addEventListener("resize", setAppHeight);

    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", setAppHeight);
      window.removeEventListener("orientationchange", setAppHeight);
      window.visualViewport?.removeEventListener("resize", setAppHeight);
    };
  }, []);

  // Admin: full-width, desktop-view asli — tidak ikut mobile-frame
  if (isAdmin) {
    return <main className="min-h-screen">{children}</main>;
  }

  // Login: bare, tetap dalam frame (tanpa BottomNav)
  if (isLogin) {
    return (
      <div className="min-h-screen bg-gray-200 flex justify-center">
        <div
          className="relative w-full max-w-[480px] bg-white md:shadow-2xl transform-gpu overflow-y-auto"
          style={{ height: "var(--app-height, 100dvh)" }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center">
      {/* Mobile-frame: tinggi dipaksa via --app-height (JS) biar akurat di PWA,
          fallback 100dvh kalau JS belum jalan. Header & bottom nav jadi flex
          item statis di luar area scroll → selalu nempel di bawah LAYAR. */}
      <div
        className="relative w-full max-w-[480px] bg-white md:shadow-2xl transform-gpu flex flex-col overflow-hidden"
        style={{ height: "var(--app-height, 100dvh)" }}
      >
        <BottomNav>{children}</BottomNav>
      </div>
    </div>
  );
}
