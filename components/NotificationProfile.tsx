"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function NotificationProfile() {
  const supabase = createClient();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
      setAvatarUrl(data?.avatar_url ?? null);
    };
    load();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-4">
      <div className="relative" ref={ref}>
        <button
          onClick={() => setShowNotif((s) => !s)}
          className="text-gray-500 hover:text-gray-800 relative"
          aria-label="Notifikasi"
        >
          <Bell size={22} />
        </button>
        {showNotif && (
          <div className="absolute right-0 mt-2 w-64 bg-white border rounded-xl shadow-lg p-4 z-50">
            <p className="text-sm font-semibold mb-2">Notifikasi</p>
            <p className="text-sm text-gray-400">Belum ada notifikasi.</p>
          </div>
        )}
      </div>

      <Link href="/profile">
        <img
          src={avatarUrl || "https://ui-avatars.com/api/?name=U"}
          alt="Profil"
          className="w-9 h-9 rounded-full object-cover border"
        />
      </Link>
    </div>
  );
}
