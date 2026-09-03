"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Compass, Users, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NotificationProfile from "./NotificationProfile";

const menu = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/my-circle", label: "My Circle", icon: Users },
  { href: "/profile", label: "Akun", icon: UserCircle },
];

export default function BottomNav() {
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

  if (pathname === "/login" || pathname === "/onboarding") return null;

  const isBeranda = pathname === "/";
  const firstName = profile?.full_name?.split(" ")[0] ?? "Sobat";

  return (
    <>
      {/* Top bar: avatar + sapaan di kiri, notif di kanan — cuma tampil di beranda */}
      {isBeranda && (
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b sticky top-0 z-40">
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
