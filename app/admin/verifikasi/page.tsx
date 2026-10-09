"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Pagination, { usePagination } from "@/components/ui/Pagination";
import { toast } from "sonner";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

export default function AdminVerifikasiPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"antrian" | "verified">("antrian");
  const [pending, setPending] = useState<any[]>([]);
  const [verified, setVerified] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const pendingPg = usePagination(pending);
  const verifiedPg = usePagination(verified);

  const load = async () => {
    const [{ data: req }, { data: ver }] = await Promise.all([
      supabase
        .from("verification_requests")
        .select("id, user_id, code, instagram, created_at, profile:profiles(full_name, nickname, avatar_url)")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name, nickname, avatar_url, instagram, verified_at")
        .eq("is_verified", true)
        .order("verified_at", { ascending: false }),
    ]);
    setPending(req ?? []);
    setVerified(ver ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const review = async (r: any, approve: boolean) => {
    let reason: string | null = null;
    if (!approve) {
      reason = window.prompt("Alasan penolakan (opsional, dikirim ke user):", "Kode belum terlihat di bio Instagram");
      if (reason === null) return;
    }
    setBusyId(r.id);
    const { error } = await supabase.rpc("admin_review_verification", {
      p_request_id: r.id,
      p_approve: approve,
      p_reason: reason,
    });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(approve ? "Disetujui." : "Ditolak.");
    load();
  };

  const revoke = async (u: any) => {
    if (!confirm(`Cabut verifikasi ${u.nickname || u.full_name}?`)) return;
    const { error } = await supabase.rpc("admin_set_verified", { p_user_id: u.id, p_value: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verifikasi dicabut.");
    load();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">Verifikasi Akun</h1>
        <p className="text-sm text-gray-400">
          Cek bio Instagram user: kode harus persis sama. Setujui kalau cocok, tolak kalau tidak.
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { v: "antrian", label: `Antrian (${pending.length})` },
          { v: "verified", label: `Terverifikasi (${verified.length})` },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v as any)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
              tab === t.v ? "bg-primary text-white border-primary" : "text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-400 text-sm">Memuat...</p>}

      {tab === "antrian" && (
        <div className="space-y-3">
          {pendingPg.pageItems.map((r) => {
            const handle = (r.instagram ?? "").trim().replace(/^@/, "");
            return (
              <div key={r.id} className="bg-white border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={r.profile?.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(r.profile?.full_name || "U")}
                    className="w-10 h-10 rounded-full object-cover"
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{r.profile?.nickname || r.profile?.full_name}</p>
                    <a
                      href={`https://instagram.com/${encodeURIComponent(handle)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary inline-flex items-center gap-1"
                    >
                      @{handle} <ExternalLink size={12} />
                    </a>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="text-sm">
                  Kode: <code className="bg-gray-100 rounded px-2 py-1 font-mono">{r.code}</code>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => review(r, true)}
                    disabled={busyId === r.id}
                    className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Setujui
                  </button>
                  <button
                    onClick={() => review(r, false)}
                    disabled={busyId === r.id}
                    className="flex-1 border border-red-200 text-red-600 rounded-xl py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            );
          })}
          {!loading && !pending.length && <p className="text-sm text-gray-400">Tidak ada antrian.</p>}
          <Pagination {...pendingPg.pagination} />
        </div>
      )}

      {tab === "verified" && (
        <div className="space-y-2">
          {verifiedPg.pageItems.map((u) => (
            <div key={u.id} className="bg-white border rounded-xl p-3 flex items-center gap-3">
              <img
                src={u.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(u.full_name || "U")}
                className="w-10 h-10 rounded-full object-cover"
                alt=""
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  {u.nickname || u.full_name}
                  <VerifiedBadge show />
                </p>
                <p className="text-xs text-gray-400">{u.instagram}</p>
              </div>
              <button onClick={() => revoke(u)} className="text-xs text-red-500 font-medium">
                Cabut
              </button>
            </div>
          ))}
          {!loading && !verified.length && <p className="text-sm text-gray-400">Belum ada akun terverifikasi.</p>}
          <Pagination {...verifiedPg.pagination} />
        </div>
      )}
    </div>
  );
}
