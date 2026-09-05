"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NotificationProfile from "./NotificationProfile";
import IconBeranda from "./icons/IconBeranda";
import IconExplore from "./icons/IconExplore";
import IconMyCircle from "./icons/IconMyCircle";
import IconAkun from "./icons/IconAkun";

const menu = [
  { href: "/", label: "Beranda", icon: IconBeranda },
  { href: "/explore", label: "Explore", icon: IconExplore },
  { href: "/my-circle", label: "My Circle", icon: IconMyCircle },
  { href: "/profile", label: "Akun", icon: IconAkun },
];

export default function BottomNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single();
      setProfile(data);
    };
    loadProfile();
  }, []);

  // Halaman tanpa chrome (header/bottom nav) — tetap render children-nya
  if (pathname === "/login" || pathname === "/onboarding" || pathname.startsWith("/circle/")) {
    return <main className="flex-1 overflow-y-auto">{children}</main>;
  }

  const isBeranda = pathname === "/";
  const firstName = profile?.full_name?.split(" ")[0] ?? "Sobat";

  return (
    <>
      {/* Top bar: avatar + sapaan di kiri, notif di kanan — cuma tampil di beranda */}
      {isBeranda && (
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b">
          <Link href="/profile/data-user" className="shrink-0">
            <img
              src={profile?.avatar_url || "https://ui-avatars.com/api/?name=" + firstName}
              className="w-10 h-10 rounded-full object-cover"
              alt=""
            />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">Halo, {firstName} 👋</p>
            <p className="text-xs text-gray-400 truncate">Yuk cari circle mabar terdekat & gabung sekarang!</p>
          </div>
          <NotificationProfile />
        </header>
      )}

      {/* Konten halaman — area scroll internal, header & nav di luar area ini jadi selalu terlihat */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Bottom nav — flex item statis di dasar frame (bukan fixed), selalu nempel di bawah layar */}
      <nav className="shrink-0 flex justify-around bg-white border-t py-2">
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
              <Icon size={22} active={active} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
