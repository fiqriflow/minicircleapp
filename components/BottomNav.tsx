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

  return (
    <>
      {/* Mobile top bar: logo + notif + avatar */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-white border-b sticky top-0 z-40">
        <span className="font-bold text-primary text-lg">Mabar Circle</span>
        <NotificationProfile />
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden justify-around bg-white border-t py-2">
        {menu.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
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

      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b sticky top-0 z-40">
        <div className="flex items-center gap-8">
          <span className="font-bold text-primary text-lg">Mabar Circle</span>
          <div className="flex gap-6">
            {menu.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={active ? "text-primary font-semibold" : "text-gray-500 hover:text-gray-800"}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
        <NotificationProfile />
      </nav>
    </>
  );
}
