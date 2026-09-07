"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AkunDinonaktifkanPage() {
  const supabase = createClient();
  const router = useRouter();
  const [info, setInfo] = useState<{ is_banned: boolean; suspended_until: string | null; suspension_reason: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("is_banned, suspended_until, suspension_reason")
        .eq("id", user.id)
        .single();
      setInfo(data as any);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const isPermanent = info?.is_banned;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
          <ShieldAlert size={30} />
        </div>

        <h1 className="text-xl font-bold">
          {isPermanent ? "Akun Dinonaktifkan Permanen" : "Akun Dinonaktifkan Sementara"}
        </h1>

        <p className="text-sm text-gray-500">
          {isPermanent
            ? "Akunmu telah dinonaktifkan secara permanen oleh admin karena melanggar Syarat & Ketentuan atau Panduan Komunitas."
            : info?.suspended_until
            ? `Akunmu dinonaktifkan sementara sampai ${new Date(info.suspended_until).toLocaleString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}.`
            : "Akunmu sedang dinonaktifkan sementara oleh admin."}
        </p>

        {info?.suspension_reason && (
          <div className="bg-white border rounded-2xl p-4 text-left text-sm">
            <p className="text-gray-500 mb-1">Alasan:</p>
            <p className="text-gray-700">{info.suspension_reason}</p>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Kalau kamu merasa ini keliru, silakan hubungi tim kami lewat kanal bantuan.
        </p>

        <button onClick={handleLogout} className="w-full border rounded-xl py-3 font-medium text-gray-600">
          Keluar
        </button>
      </div>
    </div>
  );
}
