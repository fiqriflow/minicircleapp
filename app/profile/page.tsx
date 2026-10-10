"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, HelpCircle, Info, ShieldCheck, LogOut, ChevronRight, BarChart3, MessageSquarePlus, FileText, Scale, Users2, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { unsubscribeFromPush } from "@/lib/push";
import PushToggleRow from "@/components/profile/PushToggleRow";
import InstallPwaRow from "@/components/profile/InstallPwaRow";
import DonateRow from "@/components/profile/DonateRow";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

export default function AccountMenuPage() {
  const supabase = createClient();
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [me, setMe] = useState<{ full_name?: string | null; nickname?: string | null; avatar_url?: string | null; is_verified?: boolean | null } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc("get_my_profile").maybeSingle();
      setIsSuperAdmin(!!(data as { is_super_admin?: boolean } | null)?.is_super_admin);
      setMe(data as any);
    };
    load();
  }, []);

  const handleLogout = async () => {
    if (!confirm("Yakin mau keluar?")) return;
    // batas 3 detik: logout tidak boleh tertahan urusan push
    await Promise.race([
      unsubscribeFromPush().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">Akun</h1>

      {me && (
        <div className="flex items-center gap-3 bg-white rounded-2xl border px-4 py-3">
          {me.avatar_url ? (
            <img src={me.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover bg-gray-100" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100" />
          )}
          <p className="min-w-0 font-semibold flex items-center">
            <span className="truncate">{me.nickname || me.full_name}</span>
            <VerifiedBadge show={me.is_verified} size={18} />
          </p>
        </div>
      )}

      {/* Profil */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase px-1">Profil</h2>
        <div className="bg-white rounded-2xl border divide-y overflow-hidden">
          <Link href="/profile/data-user" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <User size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Data User</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link href="/profile/verifikasi" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <BadgeCheck size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Verifikasi Akun</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link href="/profile/statistik" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <BarChart3 size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Statistik</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <PushToggleRow />
          <InstallPwaRow />
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
          <DonateRow />
        </div>
      </div>

      {/* Legal */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase px-1">Legal</h2>
        <div className="bg-white rounded-2xl border divide-y overflow-hidden">
          <Link href="/profile/panduan-komunitas" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <Users2 size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Panduan Komunitas</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link href="/profile/syarat-ketentuan" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <Scale size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Syarat &amp; Ketentuan</span>
            <ChevronRight size={16} className="text-gray-300" />
          </Link>
          <Link href="/profile/kebijakan-privasi" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
            <FileText size={18} className="text-gray-400" />
            <span className="flex-1 text-sm font-medium">Kebijakan Privasi</span>
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
