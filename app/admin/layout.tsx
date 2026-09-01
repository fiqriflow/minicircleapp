"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays, Image as ImageIcon, Settings2 } from "lucide-react";

const menu = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/player", label: "Player", icon: Users },
  { href: "/admin/circle", label: "Circle", icon: CalendarDays },
  { href: "/admin/appearance", label: "Tampilan", icon: ImageIcon },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Mobile: tab bar horizontal di atas */}
      <nav className="flex md:hidden overflow-x-auto bg-gray-900 text-white sticky top-0 z-30">
        {menu.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap ${
                active ? "border-b-2 border-primary text-primary" : "text-gray-300"
              }`}
            >
              <Icon size={16} /> {label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop: sidebar */}
      <aside className="w-56 bg-gray-900 text-white p-4 space-y-6 hidden md:block shrink-0">
        <h2 className="font-bold text-lg">Super Admin</h2>
        <nav className="space-y-1">
          {menu.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  active ? "bg-gray-800 text-primary" : "hover:bg-gray-800"
                }`}
              >
                <Icon size={18} /> {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 bg-gray-50 p-4 md:p-6">{children}</main>
    </div>
  );
}
