"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isLogin = pathname === "/login";

  // Admin: full-width, desktop-view asli — tidak ikut mobile-frame
  if (isAdmin) {
    return <main className="min-h-screen">{children}</main>;
  }

  // Login: bare, tetap dalam frame (tanpa BottomNav)
  if (isLogin) {
    return (
      <div className="min-h-screen bg-gray-200 flex justify-center">
        <div className="relative w-full max-w-[480px] h-dvh bg-white md:shadow-2xl transform-gpu overflow-y-auto">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center">
      {/* Mobile-frame: frame setinggi layar (h-screen), header & bottom nav jadi flex item statis di luar area scroll,
          jadi bottom nav selalu nempel di bawah LAYAR, bukan di bawah konten (fix bug "gak sticky" kalau konten panjang) */}
      <div className="relative w-full max-w-[480px] h-dvh bg-white md:shadow-2xl transform-gpu flex flex-col overflow-hidden">
        <BottomNav>{children}</BottomNav>
      </div>
    </div>
  );
}
