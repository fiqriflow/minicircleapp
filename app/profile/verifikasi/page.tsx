"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

export default function VerifikasiAkunPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data: p } = await supabase.rpc("get_my_profile").maybeSingle();
    setProfile(p);
    if (!p) {
      setLoading(false);
      return;
    }
    const { data: r } = await supabase
      .from("verification_requests")
      .select("*")
      .eq("user_id", (p as any)?.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setRequest(r ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRequest = async () => {
    setSubmitting(true);
    const { error } = await supabase.rpc("request_verification").single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(request.code);
      toast.success("Kode disalin.");
    } catch {
      toast.error("Gagal menyalin, salin manual.");
    }
  };

  if (loading) return <p className="p-6 text-gray-400 text-center">Memuat...</p>;

  const handle = (profile?.instagram ?? "").replace(/^@/, "");
  const incomplete = !profile?.instagram || !profile?.avatar_url;
  const pending = request?.status === "pending";
  const rejected = request?.status === "rejected";

  return (
    <div className="px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-gray-100" aria-label="Kembali">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">Verifikasi Akun</h1>
      </div>

      {profile?.is_verified ? (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
          <p className="font-semibold flex items-center">
            Akunmu sudah terverifikasi <VerifiedBadge show size={18} />
          </p>
          <p className="text-sm text-gray-600">
            Centang biru tampil di profil, line up, dan kartu host. Kode di bio Instagram sudah boleh dihapus.
            Kalau kamu mengganti akun Instagram, verifikasi otomatis dicabut dan perlu diajukan ulang.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white border rounded-2xl p-4 space-y-2 text-sm text-gray-600">
            <p className="font-semibold text-gray-800 flex items-center gap-2">
              <BadgeCheck size={18} className="text-blue-500" /> Dapatkan centang biru
            </p>
            <p>
              Gratis. Buktikan akun Instagram yang tertera di profilmu memang milikmu dengan menempel kode unik di
              bio. Admin akan mengecek, lalu menyetujui. Ini bukan verifikasi identitas / KTP.
            </p>
          </div>

          {incomplete && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 space-y-2">
              <p>Lengkapi dulu foto profil dan Instagram.</p>
              <Link href="/profile/data-user" className="font-medium underline">
                Buka Data Diri
              </Link>
            </div>
          )}

          {rejected && !pending && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-700">
              Pengajuan terakhir ditolak{request.reject_reason ? `: ${request.reject_reason}` : "."} Kamu bisa
              mengajukan lagi.
            </div>
          )}

          {pending ? (
            <div className="bg-white border rounded-2xl p-4 space-y-4">
              <p className="text-sm font-semibold">Menunggu pengecekan admin</p>
              <ol className="text-sm text-gray-600 space-y-3 list-decimal pl-5">
                <li>
                  Salin kode ini:
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 bg-gray-100 rounded-xl px-3 py-2 font-mono text-base tracking-wider text-center">
                      {request.code}
                    </code>
                    <button onClick={copyCode} className="p-2 rounded-xl border hover:bg-gray-50" aria-label="Salin kode">
                      <Copy size={18} />
                    </button>
                  </div>
                </li>
                <li>
                  Tempel di <b>bio</b> Instagram <b>@{handle}</b>. Pastikan akunnya tidak digembok supaya admin bisa
                  melihat.
                </li>
                <li>Biarkan kode di bio sampai disetujui. Kamu akan dapat notifikasi hasilnya.</li>
              </ol>
              <a
                href={`https://instagram.com/${handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary font-medium"
              >
                <ExternalLink size={14} /> Buka Instagram @{handle}
              </a>
            </div>
          ) : (
            <button
              onClick={handleRequest}
              disabled={submitting || incomplete}
              className="w-full bg-primary text-white rounded-xl py-3 font-medium disabled:opacity-50"
            >
              {submitting ? "Memproses..." : rejected ? "Ajukan Lagi" : "Ajukan Verifikasi"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
