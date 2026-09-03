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
        <div className="relative w-full max-w-[480px] min-h-screen bg-white md:shadow-2xl transform-gpu">
          <main className="min-h-screen">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 flex justify-center">
      {/* Mobile-frame: mobile layout dipakai di semua ukuran layar, dibungkus frame lebar HP di desktop (ala WhatsApp Web) */}
      <div className="relative w-full max-w-[480px] min-h-screen bg-white md:shadow-2xl transform-gpu">
        <BottomNav />
        <main className="pb-20">{children}</main>
      </div>
    </div>
  );
}
