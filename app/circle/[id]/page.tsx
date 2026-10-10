"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MoreVertical, Link as LinkIcon, Trash2, ArrowLeft, Tag, MapPin, Crosshair, CalendarDays, Users, Flag, Share2, Megaphone, Copy, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { mapEnergyError, notifyEnergyChanged } from "@/lib/energy";
import MemberProfileModal from "@/components/circle/MemberProfileModal";
import JoinQuestionModal from "@/components/circle/JoinQuestionModal";
import ReportModal from "@/components/circle/ReportModal";
import { getDefaultCoverMap, resolveCircleCover } from "@/lib/appSettings";
import { getCircleDisplayStatus, STATUS_LABEL, isCircleFull } from "@/lib/circleStatus";
import { extractStoragePath } from "@/lib/storagePath";
import { getJoinedCounts } from "@/lib/circleMembers";
import { markCommentNotifRead } from "@/lib/notifications";
import CreateCircleModal from "@/components/circle/CreateCircleModal";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import { hasJoinFilters } from "@/lib/joinFilters";
import { PUBLIC_PROFILE_COLUMNS, isProfileIncompleteError } from "@/lib/profile";
import { CIRCLE_COLUMNS } from "@/lib/circleColumns";

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [circle, setCircle] = useState<any>(null);
  const [coverError, setCoverError] = useState(false);
  const [host, setHost] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<"joined" | "pending" | null>(null);
  const [tab, setTab] = useState<"detail" | "lineup" | "chat">("detail");
  const [newComment, setNewComment] = useState("");
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showJoinQuestion, setShowJoinQuestion] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"join" | "leave" | null>(null);
  const [confirmStatusAction, setConfirmStatusAction] = useState<"started" | "completed" | "cancelled" | null>(null);
  const [showEditCircle, setShowEditCircle] = useState(false);
  const [defaultCoverMap, setDefaultCoverMap] = useState<Record<string, string>>({});
  const [hasNewComment, setHasNewComment] = useState(false);
  const [joinedCount, setJoinedCount] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const [showViewerMenu, setShowViewerMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "circle" | "user"; name?: string; userId?: string } | null>(
    null
  );

  const isJoined = myStatus === "joined";
  const isHost = !!(userId && circle && userId === circle.created_by);
  const [myIsCoHost, setMyIsCoHost] = useState(false);
  const [announcement, setAnnouncement] = useState<any>(null);
  const [announceText, setAnnounceText] = useState("");
  const [showAnnounceForm, setShowAnnounceForm] = useState(false);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const isCoHost = !isHost && myIsCoHost && !!circle?.is_circle_plus;
  const canManage = isHost || isCoHost; // host atau co host: approve/tolak, koreksi hadir
  const coHostCount = members.filter((m) => m.is_co_host).length;
  const displayStatus = circle ? getCircleDisplayStatus(circle, { joined: joinedCount, max: circle.max_participants }) : null;
  const isCommentLocked = displayStatus === "completed" || displayStatus === "cancelled";

  // pengumuman ter-pin (RLS: hanya member joined / host yang bisa baca)
  const loadAnnouncement = async () => {
    const { data } = await supabase
      .from("circle_announcements")
      .select("id, message, created_at, author:profiles(nickname, full_name)")
      .eq("circle_id", id)
      .eq("is_pinned", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAnnouncement(data ?? null);
  };

  const load = async () => {
    const [{ data: { user } }, { data: c, error: cErr }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("circles").select(CIRCLE_COLUMNS).eq("id", id).single(),
    ]);
    setUserId(user?.id ?? null);
    if (!c) {
      // PGRST116 = baris tidak ada / tidak boleh diakses, 22P02 = id bukan uuid.
      // Error lain (jaringan/DB) BUKAN "circle tidak ditemukan" -> tawarkan coba lagi.
      if (cErr && cErr.code !== "PGRST116" && cErr.code !== "22P02") {
        setLoadFailed(true);
        return;
      }
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setLoadFailed(false);
    setCircle(c);

    const [hostRes, { data: allMembers }] = await Promise.all([
      c?.created_by
        ? supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("id", c.created_by).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("circle_members")
        // join_answer sengaja tidak di-select (dicabut dari client, lihat migration 0030) -> host ambil lewat RPC
        .select(`id, circle_id, user_id, status, joined_at, checked_in, checked_in_at, energy_penalized, is_co_host, profile:profiles(${PUBLIC_PROFILE_COLUMNS})`)
        .eq("circle_id", id),
    ]);
    if (c?.created_by) setHost(hostRes.data);

    const joined = (allMembers ?? []).filter((m) => m.status === "joined");
    let pending = (allMembers ?? []).filter((m) => m.status === "pending");

    // jawaban pertanyaan join cuma boleh dibaca host
    const mine = allMembers?.find((m) => m.user_id === user?.id);
    const iAmCoHost = !!(mine?.status === "joined" && mine?.is_co_host && c?.is_circle_plus);
    setMyIsCoHost(iAmCoHost);
    if (c?.created_by && (c.created_by === user?.id || iAmCoHost) && pending.length > 0) {
      const { data: answers } = await supabase.rpc("get_circle_join_answers", { p_circle_id: id });
      const answerMap = new Map<string, string | null>(
        (answers ?? []).map((a: any) => [a.member_id, a.join_answer] as [string, string | null])
      );
      pending = pending.map((m) => ({ ...m, join_answer: answerMap.get(m.id) ?? null }));
    }
    setMembers(joined);
    setPendingMembers(pending);
    setJoinedCount(joined.length);

    setMyStatus(mine ? (mine.status as "joined" | "pending") : null);
    if (mine?.status === "joined" || (c?.created_by && c.created_by === user?.id)) {
      loadAnnouncement();
    } else {
      setAnnouncement(null);
    }

    if (mine?.status === "joined") {
      const { data: cm } = await supabase
        .from("circle_comments")
        .select("*, profile:profiles(full_name, avatar_url, is_verified)")
        .eq("circle_id", id)
        .order("created_at", { ascending: true });
      setComments(cm ?? []);
    } else {
      setComments([]);
    }
  };

  useEffect(() => {
    load();
    getDefaultCoverMap(supabase).then(setDefaultCoverMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // polling komen baru tiap 10 detik (kalau sudah join): hanya ambil yang LEBIH BARU dari komen terakhir,
  // dan berhenti saat tab tidak terlihat.
  const commentsRef = useRef<any[]>([]);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  // komen terbaru selalu terlihat: scroll kotak chat ke bawah saat tab dibuka / ada komen baru
  useEffect(() => {
    if (tab !== "chat") return;
    const el = chatBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length, tab]);

  useEffect(() => {
    if (!isJoined) return;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadAnnouncement();
      const last = commentsRef.current[commentsRef.current.length - 1]?.created_at;
      let q = supabase
        .from("circle_comments")
        .select("*, profile:profiles(full_name, avatar_url, is_verified)")
        .eq("circle_id", id)
        .order("created_at", { ascending: true });
      if (last) q = q.gt("created_at", last);
      const { data: fresh } = await q;
      if (fresh && fresh.length > 0) {
        setComments((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          const add = fresh.filter((c: any) => !seen.has(c.id));
          if (add.length === 0) return prev;
          if (tab !== "chat") setHasNewComment(true);
          return [...prev, ...add];
        });
      }
    };
    const interval = setInterval(poll, 10000);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isJoined, tab, id]);

  const doJoin = async (answer?: string) => {
    if (!userId) return;
    // re-check slot langsung sebelum insert (hindari race condition/slot penuh)
    const { count } = await supabase
      .from("circle_members")
      .select("id", { count: "exact", head: true })
      .eq("circle_id", id)
      .eq("status", "joined");
    if (isCircleFull(count ?? 0, circle.max_participants)) {
      toast.error("Slot circle ini sudah penuh.");
      load();
      return;
    }
    const { error: joinError } = await supabase.from("circle_members").insert({
      circle_id: id,
      user_id: userId,
      status: circle.requires_approval ? "pending" : "joined",
      join_answer: answer ?? null,
    });
    if (joinError) {
      if (isProfileIncompleteError(joinError.message)) {
        toast.error(joinError.message);
        router.push("/profile/data-user");
        return;
      }
      toast.error(mapEnergyError(joinError.message) ?? joinError.message);
      return;
    }
    notifyEnergyChanged();
    toast.success(circle.requires_approval ? "Permintaan join terkirim, menunggu persetujuan host." : "Berhasil join circle!");
    load();
  };

  const handleJoinToggle = () => {
    if (!userId) return;
    if (!myStatus && isCircleFull(joinedCount, circle.max_participants)) {
      toast.error("Slot circle ini sudah penuh.");
      return;
    }
    setConfirmAction(myStatus ? "leave" : "join");
  };

  const confirmJoin = () => {
    setConfirmAction(null);
    if (circle.join_question) {
      setShowJoinQuestion(true);
      return;
    }
    doJoin();
  };

  const confirmLeave = async () => {
    setConfirmAction(null);
    const wasPending = myStatus === "pending";
    const { data, error } = await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", id)
      .eq("user_id", userId)
      .select("id");
    if (error || !data || data.length === 0) {
      toast.error(error?.message ?? "Tidak bisa batal join: circle sudah berlangsung atau selesai.");
      load();
      return;
    }
    toast.success(wasPending ? "Permintaan join dibatalkan." : "Berhasil batal join circle.");
    load();
  };

  const handleApprove = async (memberId: string) => {
    const { data, error } = await supabase
      .from("circle_members")
      .update({ status: "joined" })
      .eq("id", memberId)
      .select("id");
    if (error || !data || data.length === 0) {
      toast.error(error?.message ?? "Gagal menerima permintaan join.");
    } else {
      toast.success("Permintaan join diterima.");
    }
    load();
  };

  const handleReject = async (memberId: string) => {
    const { data, error } = await supabase.from("circle_members").delete().eq("id", memberId).select("id");
    if (error || !data || data.length === 0) {
      toast.error(error?.message ?? "Gagal menolak permintaan join.");
    } else {
      toast.success("Permintaan join ditolak.");
    }
    load();
  };

  const handleCheckin = async (memberRowId: string) => {
    const { data, error } = await supabase
      .from("circle_members")
      .update({ checked_in: true, checked_in_at: new Date().toISOString() })
      .eq("id", memberRowId)
      .select("id");
    // RLS yang menolak UPDATE tidak memberi error, hanya 0 baris -> jangan klaim sukses
    if (error || !data || data.length === 0) {
      toast.error("Gagal check-in" + (error ? ": " + error.message : ". Check-in belum dibuka atau circle sudah selesai."));
      load();
      return;
    }
    toast.success("Check-in berhasil!");
    load();
  };

  const handleToggleCoHost = async (m: any) => {
    const next = !m.is_co_host;
    const name = m.profile?.nickname || m.profile?.full_name || "member ini";
    if (!window.confirm(next ? `Jadikan ${name} co host? Dia bisa terima/tolak permintaan join dan koreksi kehadiran.` : `Cabut peran co host ${name}?`)) return;
    const { error } = await supabase.rpc("set_circle_co_host", { p_member_row_id: m.id, p_value: next });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Co host ditunjuk." : "Co host dicabut.");
    load();
  };

  const handleToggleCheckinHost = async (m: any) => {
    const { error } = await supabase.rpc("host_set_checkin", {
      p_member_row_id: m.id,
      p_checked_in: !m.checked_in,
    });
    if (error) {
      toast.error("Gagal ubah status hadir: " + error.message);
      return;
    }
    load();
  };

  const handlePostAnnouncement = async () => {
    const msg = announceText.trim();
    if (!msg || postingAnnouncement) return;
    setPostingAnnouncement(true);
    const { error } = await supabase.rpc("post_circle_announcement", { p_circle_id: id, p_message: msg });
    setPostingAnnouncement(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pengumuman di-pin & dikirim ke semua member.");
    setAnnounceText("");
    setShowAnnounceForm(false);
    loadAnnouncement();
  };

  const handleUnpinAnnouncement = async () => {
    const { error } = await supabase.rpc("unpin_circle_announcement", { p_circle_id: id });
    if (error) {
      toast.error(error.message);
      return;
    }
    setAnnouncement(null);
  };

  const handleSendComment = async () => {
    const message = newComment.trim();
    if (!message || !userId || isCommentLocked || sendingComment) return;
    setSendingComment(true);
    const { data, error } = await supabase
      .from("circle_comments")
      .insert({ circle_id: id, user_id: userId, message })
      .select("*, profile:profiles(full_name, avatar_url, is_verified)")
      .single();
    setSendingComment(false);
    if (error) {
      // input tidak dikosongkan supaya pesan tidak hilang
      toast.error(error.message || "Gagal mengirim komentar.");
      return;
    }
    setNewComment("");
    if (data) setComments((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
  };

  const handleSetStatus = async (status: string) => {
    const { error } = await supabase.from("circles").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    setShowHostMenu(false);
    load();
  };

  const handleStartCircle = async () => {
    // waktu mulai dicap server (trigger guard_circle_write)
    const { error } = await supabase.from("circles").update({ started_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Circle ditandai mulai.");
    setShowHostMenu(false);
    load();
  };

  const handleToggleApproval = async () => {
    const { error } = await supabase.from("circles").update({ requires_approval: !circle.requires_approval }).eq("id", id);
    if (error) toast.error(error.message);
    setShowHostMenu(false);
    load();
  };

  const handleCopyInvite = async () => {
    const { data: code, error } = await supabase.rpc("get_circle_invite_code", { p_circle_id: id });
    if (error || !code) {
      toast.error("Kode undangan tidak tersedia.");
      setShowHostMenu(false);
      return;
    }
    const url = `${location.origin}/join/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link undangan disalin.");
    } catch {
      window.prompt("Salin link undangan ini:", url);
    }
    setShowHostMenu(false);
  };

  const handleShareCircle = async () => {
    let url = `${location.origin}/circle/${id}`;
    // Circle private tidak terlihat oleh non-member -> yang dibagikan harus link undangan
    // (kode hanya bisa diambil host / co host / admin).
    if (circle.is_private) {
      const { data: code, error } = await supabase.rpc("get_circle_invite_code", { p_circle_id: id });
      if (error || !code) {
        toast.error("Circle private hanya bisa dibagikan lewat link undangan oleh host / co host.");
        setShowHostMenu(false);
        setShowViewerMenu(false);
        return;
      }
      url = `${location.origin}/join/${code}`;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: circle.name, text: `Yuk gabung circle "${circle.name}"!`, url });
      } catch {
        // user batal share, gak apa-apa
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success(circle.is_private ? "Link undangan disalin!" : "Link circle disalin!");
      } catch {
        window.prompt("Salin link ini:", url);
      }
    }
    setShowHostMenu(false);
    setShowViewerMenu(false);
  };

  const handleDeleteCircle = async () => {
    if (!confirm("Yakin mau hapus circle ini? Semua data line up dan komentar akan ikut terhapus dan tidak bisa dikembalikan.")) {
      return;
    }
    const coverPath = extractStoragePath(circle.cover_url, "circle-covers");
    const { data: deleted, error: delError } = await supabase.from("circles").delete().eq("id", id).select("id");
    if (delError || !deleted || deleted.length === 0) {
      toast.error("Gagal hapus circle" + (delError ? ": " + delError.message : "."));
      return;
    }
    if (coverPath) {
      await supabase.storage.from("circle-covers").remove([coverPath]);
    }
    toast.success("Circle berhasil dihapus.");
    router.push("/my-circle");
  };

  if (notFound) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-gray-500">Circle tidak ditemukan, sudah dihapus, atau tidak bisa kamu akses.</p>
        <button onClick={() => router.push("/")} className="text-primary font-medium">
          Ke Beranda
        </button>
      </div>
    );
  }
  if (loadFailed && !circle) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-gray-500">Gagal memuat circle. Cek koneksi lalu coba lagi.</p>
        <button
          onClick={() => {
            setLoadFailed(false);
            load();
          }}
          className="text-primary font-medium"
        >
          Coba lagi
        </button>
      </div>
    );
  }
  if (!circle) return <p className="p-6 text-gray-400">Memuat...</p>;

  return (
    <div className="px-4 py-6 space-y-6 pb-28">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-40 bg-gray-200 rounded-2xl overflow-hidden relative">
          {(() => {
            const cover = resolveCircleCover(defaultCoverMap, circle.category, circle.cover_url);
            return cover && !coverError ? (
              <img
                src={cover}
                alt={circle.name}
                className="w-full h-full object-cover"
                onError={() => setCoverError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400 text-sm font-medium">Cover belum diatur</span>
              </div>
            );
          })()}
          <button
            onClick={() => router.back()}
            className="absolute top-2 left-2 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </button>
          {(() => {
            const displayStatus = getCircleDisplayStatus(circle, { joined: joinedCount, max: circle.max_participants });
            const info = STATUS_LABEL[displayStatus];
            return (
              <span className={`absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-full ${info.className}`}>
                {info.label}
              </span>
            );
          })()}
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold break-words">{circle.name}</h1>
              {circle.is_circle_plus && (
                <span className="text-xs bg-primary text-white px-2 py-1 rounded-full shrink-0">Circle+</span>
              )}
              {circle.is_private && (
                <span
                  title="Circle private"
                  aria-label="Circle private"
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-500 shrink-0"
                >
                  <Lock size={12} />
                </span>
              )}
            </div>
            {circle.group_name && <p className="text-sm text-gray-400">{circle.group_name}</p>}
          </div>

          {isHost && (
            <div className="relative shrink-0">
              <button
                onClick={() => setShowHostMenu((s) => !s)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Pengaturan Circle"
              >
                <MoreVertical size={20} />
              </button>
              {showHostMenu && <div className="fixed inset-0 z-40" onClick={() => setShowHostMenu(false)} />}
              {showHostMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border rounded-xl shadow-lg overflow-hidden z-50">
                  <button
                    onClick={() => {
                      setShowEditCircle(true);
                      setShowHostMenu(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b"
                  >
                    Edit Circle
                  </button>
                  <button
                    onClick={handleShareCircle}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 border-b"
                  >
                    <Share2 size={14} /> Bagikan Circle
                  </button>
                  <button
                    onClick={() => {
                      setShowHostMenu(false);
                      setShowDuplicate(true);
                    }}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 border-b"
                  >
                    <Copy size={14} /> Duplikat Circle
                  </button>
                  {(displayStatus === "open" || displayStatus === "full") && (
                    <button
                      onClick={() => {
                        setShowHostMenu(false);
                        setConfirmStatusAction("started");
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-green-600 hover:bg-green-50 border-b"
                    >
                      Tandai Mulai
                    </button>
                  )}
                  {displayStatus === "ongoing" && (
                    <button
                      onClick={() => {
                        setShowHostMenu(false);
                        setConfirmStatusAction("completed");
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-green-600 hover:bg-green-50 border-b"
                    >
                      Tandai Selesai
                    </button>
                  )}
                  {displayStatus !== "completed" && displayStatus !== "cancelled" && (
                    <button
                      onClick={() => {
                        setShowHostMenu(false);
                        setConfirmStatusAction("cancelled");
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-b"
                    >
                      Batalkan Circle
                    </button>
                  )}
                  {circle.is_circle_plus && (
                    <button
                      onClick={handleToggleApproval}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b"
                    >
                      {circle.requires_approval ? "Matikan" : "Aktifkan"} Perlu Approval Join
                    </button>
                  )}
                  {circle.is_circle_plus && (
                    <button
                      onClick={handleCopyInvite}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 border-b"
                    >
                      <LinkIcon size={14} /> Salin Link Undangan
                    </button>
                  )}
                  <button
                    onClick={handleDeleteCircle}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 size={14} /> Hapus Circle
                  </button>
                </div>
              )}
            </div>
          )}

          {!isHost && (
            <div className="relative shrink-0">
              <button
                onClick={() => setShowViewerMenu((s) => !s)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Opsi Circle"
              >
                <MoreVertical size={20} />
              </button>
              {showViewerMenu && <div className="fixed inset-0 z-40" onClick={() => setShowViewerMenu(false)} />}
              {showViewerMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-lg overflow-hidden z-50">
                  {(!circle.is_private || canManage) && (
                    <button
                      onClick={handleShareCircle}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 border-b"
                    >
                      <Share2 size={14} /> Bagikan Circle
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowViewerMenu(false);
                      setReportTarget({ type: "circle", name: circle.name });
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Flag size={14} /> Laporkan Circle
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {(circle.category || circle.city) && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {circle.category && (
              <span className="flex items-center gap-1">
                <Tag size={14} /> {circle.category}
              </span>
            )}
            {circle.category && circle.city && <span>•</span>}
            {circle.city && (
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {circle.city}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Slot indicator — di atas tombol join/batal join */}
      {!isHost && circle.max_participants && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Slot Terisi</span>
            <span className="font-medium text-gray-600">{joinedCount}/{circle.max_participants}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, Math.round((joinedCount / circle.max_participants) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Join button dipindah ke footer sticky bawah, lihat akhir file */}

      {showEditCircle && (
        <CreateCircleModal
          editCircle={circle}
          onClose={() => setShowEditCircle(false)}
          onCreated={load}
        />
      )}

      {showDuplicate && (
        <CreateCircleModal
          templateCircle={circle}
          circleType={circle.is_circle_plus ? "plus" : "regular"}
          onClose={() => setShowDuplicate(false)}
          onCreated={() => {
            toast.success("Circle baru berhasil dibuat dari salinan.");
            router.push("/my-circle");
          }}
        />
      )}

      {confirmAction && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4"
          onClick={() => setConfirmAction(null)}
        >
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">
              {confirmAction === "join" ? "Konfirmasi Join Circle" : "Konfirmasi Batal Join"}
            </h3>
            <p className="text-sm text-gray-600">
              {confirmAction === "join"
                ? `Dengan join circle "${circle.name}", saya berkomitmen untuk hadir dan berpartisipasi sesuai jadwal yang sudah ditentukan. Kalau berhalangan, saya akan membatalkan join lebih awal supaya slot bisa diisi orang lain.`
                : myStatus === "pending"
                ? `Batalkan permintaan join ke circle "${circle.name}"?`
                : `Kamu yakin mau batal join circle "${circle.name}"? Slot kamu akan dilepas dan bisa diisi peserta lain.`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 border rounded-xl py-3 font-medium text-gray-500"
              >
                Batal
              </button>
              <button
                onClick={confirmAction === "join" ? confirmJoin : confirmLeave}
                className={`flex-1 rounded-xl py-3 font-medium text-white ${
                  confirmAction === "join" ? "bg-primary hover:bg-primary-dark" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {confirmAction === "join" ? "Ya, Saya Berkomitmen" : "Ya, Batal Join"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmStatusAction && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4"
          onClick={() => setConfirmStatusAction(null)}
        >
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg">
              {confirmStatusAction === "started"
                ? "Tandai Circle Mulai?"
                : confirmStatusAction === "completed"
                ? "Tandai Circle Selesai?"
                : "Batalkan Circle?"}
            </h3>
            <p className="text-sm text-gray-600">
              {confirmStatusAction === "started"
                ? `Circle "${circle.name}" akan ditandai sedang berlangsung (check-in dibuka). Bisa dilakukan maksimal 2 jam sebelum acara.`
                : confirmStatusAction === "completed"
                ? `Circle "${circle.name}" akan ditandai selesai. Member yang belum check-in kena penalti energy.`
                : `Circle "${circle.name}" akan dibatalkan.`}{" "}
              Tindakan ini <span className="font-semibold">tidak bisa diubah kembali</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmStatusAction(null)}
                className="flex-1 border rounded-xl py-3 font-medium text-gray-500"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (confirmStatusAction === "started") handleStartCircle();
                  else handleSetStatus(confirmStatusAction);
                  setConfirmStatusAction(null);
                }}
                className={`flex-1 rounded-xl py-3 font-medium text-white ${
                  confirmStatusAction === "cancelled" ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {confirmStatusAction === "started"
                  ? "Ya, Tandai Mulai"
                  : confirmStatusAction === "completed"
                  ? "Ya, Tandai Selesai"
                  : "Ya, Batalkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinQuestion && (
        <JoinQuestionModal
          question={circle.join_question}
          onCancel={() => setShowJoinQuestion(false)}
          onSubmit={(answer) => {
            setShowJoinQuestion(false);
            doJoin(answer);
          }}
        />
      )}

      {/* Approval requests untuk host / co host */}
      {canManage && pendingMembers.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-gray-700">Menunggu Persetujuan ({pendingMembers.length})</h3>
          {pendingMembers.map((m) => (
            <div key={m.id} className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-3">
                <img loading="lazy" decoding="async"
                  src={m.profile?.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(m.profile?.full_name || "U")}
                  className="w-10 h-10 rounded-full object-cover"
                  alt=""
                />
                <p className="flex-1 font-medium">
                  {m.profile?.nickname || m.profile?.full_name}
                  <VerifiedBadge show={m.profile?.is_verified} />
                </p>
                <button onClick={() => handleApprove(m.id)} className="text-primary text-sm font-medium">Terima</button>
                <button onClick={() => handleReject(m.id)} className="text-red-500 text-sm font-medium">Tolak</button>
              </div>
              {m.join_answer && (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-2">"{m.join_answer}"</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pengumuman ter-pin (host / co host) */}
      {announcement && (isJoined || isHost) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
            <Megaphone size={14} />
            <span className="flex-1">
              Pengumuman dari {announcement.author?.nickname || announcement.author?.full_name || "Host"}
            </span>
            {canManage && (
              <button onClick={handleUnpinAnnouncement} className="font-medium underline">
                Lepas pin
              </button>
            )}
          </div>
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{announcement.message}</p>
          <p className="text-[11px] text-gray-400">
            {new Date(announcement.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setTab("detail")}
          className={`flex-1 py-2 font-medium ${tab === "detail" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Detail
        </button>
        <button
          onClick={() => setTab("lineup")}
          className={`flex-1 py-2 font-medium ${tab === "lineup" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Line Up ({members.length})
        </button>
        <button
          onClick={() => {
            setTab("chat");
            setHasNewComment(false);
            if (isHost && userId) markCommentNotifRead(supabase, userId, id);
          }}
          className={`relative flex-1 py-2 font-medium ${tab === "chat" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Komen Grup
          {hasNewComment && (
            <span className="absolute top-1 right-1/4 w-2.5 h-2.5 bg-red-500 rounded-full" />
          )}
        </button>
      </div>

      {tab === "detail" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 border rounded-xl p-4">
            <Crosshair size={20} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Titik Kumpul</p>
              <p className="text-sm text-gray-500">{circle.location}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 border rounded-xl p-4">
            <CalendarDays size={20} className="text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Tanggal & Jam</p>
              <p className="text-sm text-gray-500">
                {new Date(circle.event_date).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {" • "}
                {new Date(circle.event_date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {host && (
              <div className="flex items-center gap-3 border rounded-xl p-4">
                <img loading="lazy" decoding="async"
                  src={host.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(host.full_name || "U")}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                  alt=""
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">Dibuat oleh</p>
                  <p className="text-sm text-gray-500 truncate">
                  {host.nickname || host.full_name}
                  <VerifiedBadge show={host.is_verified} />
                </p>
                </div>
              </div>
            )}
            {circle.group_name && (
              <div className="flex items-center gap-3 border rounded-xl p-4">
                <Users size={20} className="text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">Grup</p>
                  <p className="text-sm text-gray-500 truncate">{circle.group_name}</p>
                </div>
              </div>
            )}
          </div>

          {hasJoinFilters(circle) && (
            <div>
              <p className="font-semibold mb-1">Syarat peserta</p>
              <div className="flex flex-wrap gap-2">
                {circle.join_gender && (
                  <span
                    className={`text-xs px-3 py-1 rounded-full ${
                      circle.join_gender === "female" ? "bg-pink-50 text-pink-600" : "bg-sky-50 text-sky-600"
                    }`}
                  >
                    {circle.join_gender === "female" ? "Khusus perempuan" : "Khusus laki-laki"}
                  </span>
                )}
                {circle.join_verified_only && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full inline-flex items-center">
                    Akun terverifikasi
                    <VerifiedBadge show size={12} />
                  </span>
                )}
              </div>
            </div>
          )}

          {circle.description && (
            <div>
              <p className="font-semibold mb-1">Deskripsi</p>
              <p className="text-gray-500 text-sm whitespace-pre-wrap break-words">{circle.description}</p>
            </div>
          )}
        </div>
      )}

      {tab === "lineup" && (
        <div className="space-y-3">
          {(displayStatus === "ongoing" || displayStatus === "completed") && (
            <p className="text-xs text-gray-400">
              {members.filter((m) => m.checked_in).length}/{members.length} sudah check-in
            </p>
          )}
          {members.map((m) => {
            const checkinOpen = Date.now() <= new Date(circle.event_date).getTime() + 24 * 60 * 60 * 1000; // sama dengan policy DB
            const canSelfCheckin = displayStatus === "ongoing" && checkinOpen && m.user_id === userId && !m.checked_in;
            const canHostOverride = canManage && displayStatus === "completed";
            const canSetCoHost =
              isHost && !!circle.is_circle_plus && displayStatus !== "completed" && displayStatus !== "cancelled" &&
              m.user_id !== circle.created_by && (m.is_co_host || coHostCount < 2);
            return (
              <div
                key={m.id}
                className="w-full flex items-center justify-between gap-3 border rounded-xl p-3"
              >
                <button
                  onClick={() => isJoined && setSelectedMember(m.profile)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <img loading="lazy" decoding="async"
                    src={m.profile?.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(m.profile?.full_name || "U")}
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                    alt=""
                  />
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {m.profile?.nickname || m.profile?.full_name}
                      <VerifiedBadge show={m.profile?.is_verified} />
                      {m.is_co_host && (
                        <span className="ml-2 align-middle text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          Co Host
                        </span>
                      )}
                    </p>
                    {isJoined && <p className="text-xs text-gray-400">Lihat profil</p>}
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {m.checked_in && (
                    <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      ✅ Hadir
                    </span>
                  )}

                  {canSelfCheckin && (
                    <button
                      onClick={() => handleCheckin(m.id)}
                      className="text-xs font-semibold text-white bg-primary px-3 py-1.5 rounded-full"
                    >
                      Check-in
                    </button>
                  )}

                  {canSetCoHost && (
                    <button
                      onClick={() => handleToggleCoHost(m)}
                      className="text-xs text-primary underline whitespace-nowrap"
                    >
                      {m.is_co_host ? "Cabut Co Host" : "Jadikan Co Host"}
                    </button>
                  )}

                  {canHostOverride && (
                    <button
                      onClick={() => handleToggleCheckinHost(m)}
                      className="text-xs text-gray-500 underline whitespace-nowrap"
                    >
                      {m.checked_in ? "Batalkan" : "Tandai Hadir"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!members.length && <p className="text-gray-400 text-sm">Belum ada yang join.</p>}
        </div>
      )}

      {tab === "chat" && (
        <div className="space-y-3">
          {isJoined ? (
            <>
              {canManage && !isCommentLocked && (
                <div className="border rounded-xl p-3 space-y-2">
                  {showAnnounceForm ? (
                    <>
                      <textarea
                        className="w-full border rounded-xl px-3 py-2 text-sm"
                        rows={3}
                        maxLength={300}
                        placeholder="Mis. Kumpul pindah ke gerbang selatan"
                        value={announceText}
                        onChange={(e) => setAnnounceText(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 flex-1">{announceText.length}/300 · di-pin & dikirim push ke semua member</span>
                        <button
                          onClick={() => {
                            setShowAnnounceForm(false);
                            setAnnounceText("");
                          }}
                          className="text-sm text-gray-500 px-2"
                        >
                          Batal
                        </button>
                        <button
                          onClick={handlePostAnnouncement}
                          disabled={!announceText.trim() || postingAnnouncement}
                          className="text-sm bg-primary text-white px-4 py-1.5 rounded-xl disabled:opacity-50"
                        >
                          {postingAnnouncement ? "Mengirim..." : "Kirim & Pin"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowAnnounceForm(true)}
                      className="w-full flex items-center justify-center gap-2 text-sm font-medium text-primary"
                    >
                      <Megaphone size={16} /> Buat Pengumuman
                    </button>
                  )}
                </div>
              )}
              <div ref={chatBoxRef} className="space-y-2 max-h-96 overflow-y-auto">
                {comments.map((c) => {
                  const isMine = c.user_id === userId;
                  return (
                    <div key={c.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl p-3 ${
                          isMine ? "bg-primary text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"
                        }`}
                      >
                        {!isMine && (
                          <p className="text-xs font-semibold mb-1 opacity-70 flex items-center">
                            {c.profile?.full_name}
                            <VerifiedBadge show={c.profile?.is_verified} size={13} />
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{c.message}</p>
                      </div>
                    </div>
                  );
                })}
                {!comments.length && <p className="text-gray-400 text-sm">Belum ada komentar.</p>}
              </div>
              {isCommentLocked ? (
                <p className="text-center text-sm text-gray-400 border rounded-xl py-3">
                  {displayStatus === "completed"
                    ? "Circle sudah selesai, komentar ditutup."
                    : "Circle dibatalkan, komentar ditutup."}
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="flex-1 border rounded-xl px-4 py-2"
                    placeholder="Tulis komentar..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && handleSendComment()}
                  />
                  <button
                    onClick={handleSendComment}
                    disabled={sendingComment}
                    className="bg-primary text-white px-4 rounded-xl disabled:opacity-50"
                  >
                    {sendingComment ? "..." : "Kirim"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm">Join circle ini dulu untuk ikut chat.</p>
          )}
        </div>
      )}

      {selectedMember && (
        <MemberProfileModal
          profile={selectedMember}
          onClose={() => setSelectedMember(null)}
          onReport={
            selectedMember.id !== userId
              ? () => {
                  setReportTarget({
                    type: "user",
                    name: selectedMember.nickname || selectedMember.full_name,
                    userId: selectedMember.id,
                  });
                  setSelectedMember(null);
                }
              : undefined
          }
        />
      )}

      {reportTarget && (
        <ReportModal
          targetType={reportTarget.type}
          targetName={reportTarget.name}
          targetCircleId={reportTarget.type === "circle" ? (circle?.id as string) : undefined}
          targetUserId={reportTarget.type === "user" ? reportTarget.userId : undefined}
          onClose={() => setReportTarget(null)}
        />
      )}

      {/* Join button — sticky di bawah, hanya tampil di tab Detail */}
      {tab === "detail" && !isHost && (() => {
        const displayStatus = getCircleDisplayStatus(circle, { joined: joinedCount, max: circle.max_participants });
        let content: React.ReactNode;
        if (displayStatus === "completed" || displayStatus === "cancelled") {
          content = (
            <button disabled className="w-full rounded-xl py-3 font-medium bg-gray-100 text-gray-400 cursor-not-allowed">
              {displayStatus === "completed" ? "Circle sudah selesai" : "Circle dibatalkan"}
            </button>
          );
        } else if (displayStatus === "full" && !myStatus) {
          content = (
            <button disabled className="w-full rounded-xl py-3 font-medium bg-gray-100 text-gray-400 cursor-not-allowed">
              Slot Penuh
            </button>
          );
        } else if (
          !myStatus &&
          displayStatus === "ongoing" &&
          (!circle.allow_late_join || Date.now() > new Date(circle.event_date).getTime() + 3 * 60 * 60 * 1000)
        ) {
          // sama dengan guard DB (0057): setelah mulai, join hanya boleh kalau host mengizinkan (maks. 3 jam setelah jam mulai)
          content = (
            <button disabled className="w-full rounded-xl py-3 font-medium bg-gray-100 text-gray-400 cursor-not-allowed">
              Pendaftaran Ditutup
            </button>
          );
        } else if (myStatus === "joined" && displayStatus === "ongoing") {
          // sama dengan policy DB (0054): tidak bisa batal join setelah circle dimulai
          content = (
            <button disabled className="w-full rounded-xl py-3 font-medium bg-gray-100 text-gray-400 cursor-not-allowed">
              Circle Sedang Berlangsung
            </button>
          );
        } else {
          content = (
            <button
              onClick={handleJoinToggle}
              className={`w-full rounded-xl py-3 font-medium ${
                myStatus === "joined"
                  ? "bg-red-50 text-red-600 border border-red-300"
                  : myStatus === "pending"
                  ? "bg-gray-100 text-gray-600 border border-gray-300"
                  : "bg-primary text-white"
              }`}
            >
              {myStatus === "joined" ? "Batal Join" : myStatus === "pending" ? "Batalkan Permintaan" : "Join Circle"}
            </button>
          );
        }
        return (
          <div className="fixed bottom-0 inset-x-0 flex justify-center z-40 pointer-events-none">
            <div className="w-full max-w-[480px] bg-white border-t p-4 pointer-events-auto">{content}</div>
          </div>
        );
      })()}
    </div>
  );
}
