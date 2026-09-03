"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, HelpCircle, Info, ShieldCheck, LogOut, ChevronRight, BarChart3, MessageSquarePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AccountMenuPage() {
  const supabase = createClient();
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single();
      setIsSuperAdmin(!!data?.is_super_admin);
    };
    load();
  }, []);

  const handleLogout = async () => {
    if (!confirm("Yakin mau keluar?")) return;
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">Akun</h1>

      {/* Profil */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase px-1">Profil</h2>
        <div className="bg-white rounded-2xl border divide-y overflow-hidden">
          <Link href="/profile/data-user" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <User size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Data User</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link href="/profile/statistik" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <BarChart3 size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Statistik</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        </div>
      </div>

      {/* Bantuan */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase px-1">Bantuan</h2>
        <div className="bg-white rounded-2xl border divide-y overflow-hidden">
          <Link href="/profile/faq" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <HelpCircle size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">FAQ</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link href="/profile/tentang-kami" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <Info size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Tentang Kami</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link href="/profile/masukan" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <MessageSquarePlus size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Masukan</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
        </div>
      </div>

      {/* Akun */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase px-1">Akun</h2>
        <div className="bg-white rounded-2xl border divide-y overflow-hidden">
          {isSuperAdmin && (
            <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <ShieldCheck size={18} className="text-gray-400" />
              <span className="flex-1 text-sm font-medium">Buka Panel Admin</span>
              <ChevronRight size={16} className="text-gray-300" />
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-left text-red-600"
          >
            <LogOut size={18} className="text-red-500" />
            <span className="flex-1 text-sm font-medium">Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
