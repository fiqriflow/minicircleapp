"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays, Image as ImageIcon, Settings2, ArrowLeftCircle, MessageSquare } from "lucide-react";

const menu = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/player", label: "Player", icon: Users },
  { href: "/admin/circle", label: "Circle", icon: CalendarDays },
  { href: "/admin/appearance", label: "Tampilan", icon: ImageIcon },
  { href: "/admin/masukan", label: "Masukan", icon: MessageSquare },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile: tab bar horizontal di atas */}
      <header className="bg-gray-900 text-white sticky top-0 z-30 md:hidden">
        <h2 className="font-bold text-lg px-4 pt-3">Super Admin</h2>
        <nav className="flex overflow-x-auto px-2">
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
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap text-gray-300 border-l border-gray-700 ml-1"
          >
            <ArrowLeftCircle size={16} /> Kembali ke App
          </Link>
        </nav>
      </header>

      {/* Desktop: sidebar samping */}
      <aside className="hidden md:flex md:flex-col w-60 bg-gray-900 text-white p-4 shrink-0 min-h-screen sticky top-0">
        <h2 className="font-bold text-lg mb-6 px-2">Super Admin</h2>
        <div className="flex-1 space-y-1">
          {menu.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                  active ? "bg-primary text-white" : "text-gray-300 hover:bg-gray-800"
                }`}
              >
                <Icon size={18} /> {label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 border-t border-gray-700 pt-4 mt-4"
        >
          <ArrowLeftCircle size={18} /> Kembali ke Beranda
        </Link>
      </aside>

      <main className="flex-1 bg-gray-50 p-4 md:p-8">{children}</main>
    </div>
  );
}
