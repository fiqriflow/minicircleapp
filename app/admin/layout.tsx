import Link from "next/link";
import { LayoutDashboard, Users, CalendarDays } from "lucide-react";

const menu = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/player", label: "Player", icon: Users },
  { href: "/admin/circle", label: "Circle", icon: CalendarDays },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-gray-900 text-white p-4 space-y-6 hidden md:block">
        <h2 className="font-bold text-lg">Super Admin</h2>
        <nav className="space-y-1">
          {menu.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-sm"
            >
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 bg-gray-50 p-6">{children}</main>
    </div>
  );
}
