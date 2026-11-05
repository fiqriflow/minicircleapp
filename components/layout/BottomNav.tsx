"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NotificationProfile from "@/components/layout/NotificationProfile";
import EnergyBadge from "@/components/layout/EnergyBadge";
import IconBeranda from "@/components/icons/IconBeranda";
import IconExplore from "@/components/icons/IconExplore";
import IconMyCircle from "@/components/icons/IconMyCircle";
import IconAkun from "@/components/icons/IconAkun";

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
  // Tab langsung aktif saat di-tap (tanpa nunggu halaman tujuan selesai load) -> terasa instan
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

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
  // Termasuk semua subpage /profile/* (data-user, statistik, faq, dll) karena
  // masing-masing sudah punya header back-button sendiri; hanya /profile (root/menu Akun) yang tetap pakai nav.
  const isProfileSubpage = pathname.startsWith("/profile/") && pathname !== "/profile";
  if (
    pathname === "/login" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/circle/") ||
    pathname === "/notifications" ||
    isProfileSubpage
  ) {
    return <main className="flex-1 overflow-y-auto">{children}</main>;
  }

  const isBeranda = pathname === "/";
  const firstName = profile?.full_name?.split(" ")[0] ?? "Sobat";

  return (
    <>
      {/* Top bar: avatar + sapaan di kiri, notif di kanan — cuma tampil di beranda */}
      {isBeranda && (
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b-2 border-gray-200">
          <Link href="/profile/data-user" className="shrink-0">
            <img
              src={profile?.avatar_url || "https://ui-avatars.com/api/?name=" + firstName}
              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
              alt=""
            />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">Halo, {firstName} 👋</p>
            <p className="text-xs text-gray-400 truncate">Yuk cari circle mabar terdekat & gabung sekarang!</p>
          </div>
          <EnergyBadge />
          <NotificationProfile />
        </header>
      )}

      {/* Konten halaman — area scroll internal, header & nav di luar area ini jadi selalu terlihat */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Bottom nav — flex item statis di dasar frame (bukan fixed), selalu nempel di bawah layar */}
      <nav className="shrink-0 flex justify-around bg-white border-t-2 border-gray-200 px-2 py-1.5">
        {menu.map(({ href, label, icon: Icon }) => {
          const current = pendingHref ?? pathname;
          const active = current === href || (href !== "/" && current.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={() => setPendingHref(href)}
              className={`press flex flex-col items-center text-[11px] font-bold gap-0.5 px-3.5 py-1.5 rounded-xl border-2 ${
                active
                  ? "text-primary bg-primary/10 border-primary"
                  : "text-gray-400 border-transparent"
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
