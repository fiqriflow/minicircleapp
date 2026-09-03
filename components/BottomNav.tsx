"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Users, UserCircle } from "lucide-react";
import NotificationProfile from "./NotificationProfile";

const menu = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/my-circle", label: "My Circle", icon: Users },
  { href: "/profile", label: "Profil", icon: UserCircle },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/onboarding") return null;

  return (
    <>
      {/* Top bar: logo + notif — selalu tampil, mobile-frame dipakai di semua ukuran layar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b sticky top-0 z-40">
        <span className="font-bold text-primary text-lg">Mabar Circle</span>
        <NotificationProfile />
      </header>

      {/* Bottom nav — fixed relatif ke frame (bukan viewport) karena parent frame punya transform-gpu */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around bg-white border-t py-2 max-w-[480px] mx-auto">
        {menu.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center text-xs gap-1 px-3 py-1 ${
                active ? "text-primary font-semibold" : "text-gray-400"
              }`}
            >
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
