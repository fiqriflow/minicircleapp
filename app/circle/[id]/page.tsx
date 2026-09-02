"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MoreVertical, Link as LinkIcon, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MemberProfileModal from "@/components/MemberProfileModal";
import JoinQuestionModal from "@/components/JoinQuestionModal";
import { getDefaultCoverMap, resolveCircleCover } from "@/lib/appSettings";
import { getCircleDisplayStatus, STATUS_LABEL } from "@/lib/circleStatus";
import { extractStoragePath } from "@/lib/storagePath";
import { getJoinedCounts } from "@/lib/circleMembers";

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [circle, setCircle] = useState<any>(null);
  const [host, setHost] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<"joined" | "pending" | null>(null);
  const [tab, setTab] = useState<"lineup" | "chat">("lineup");
  const [newComment, setNewComment] = useState("");
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showJoinQuestion, setShowJoinQuestion] = useState(false);
  const [defaultCoverMap, setDefaultCoverMap] = useState<Record<string, string>>({});
  const [hasNewComment, setHasNewComment] = useState(false);
  const [joinedCount, setJoinedCount] = useState(0);

  const isJoined = myStatus === "joined";
  const isHost = !!(userId && circle && userId === circle.created_by);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data: c } = await supabase.from("circles").select("*").eq("id", id).single();
    setCircle(c);

    if (c?.created_by) {
      const { data: h } = await supabase.from("profiles").select("*").eq("id", c.created_by).single();
      setHost(h);
    }

    const { data: allMembers } = await supabase
      .from("circle_members")
      .select("*, profile:profiles(*)")
      .eq("circle_id", id);

    const joined = (allMembers ?? []).filter((m) => m.status === "joined");
    const pending = (allMembers ?? []).filter((m) => m.status === "pending");
    setMembers(joined);
    setPendingMembers(pending);
    setJoinedCount(joined.length);

    const mine = allMembers?.find((m) => m.user_id === user?.id);
    setMyStatus(mine ? (mine.status as "joined" | "pending") : null);

    if (mine?.status === "joined") {
      const { data: cm } = await supabase
        .from("circle_comments")
        .select("*, profile:profiles(full_name, avatar_url)")
        .eq("circle_id", id)
        .order("created_at", { ascending: true });
      setComments(cm ?? []);
    }
  };

  useEffect(() => {
    load();
    getDefaultCoverMap(supabase).then(setDefaultCoverMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // polling komen baru tiap 8 detik (kalau sudah join)
  useEffect(() => {
    if (!isJoined) return;
    const interval = setInterval(async () => {
      const { data: cm } = await supabase
        .from("circle_comments")
        .select("*, profile:profiles(full_name, avatar_url)")
        .eq("circle_id", id)
        .order("created_at", { ascending: true });
      if (cm) {
        setComments((prev) => {
          if (cm.length > prev.length && tab !== "chat") setHasNewComment(true);
          return cm;
        });
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [isJoined, tab, id]);

  const doJoin = async (answer?: string) => {
    if (!userId) return;
    await supabase.from("circle_members").insert({
      circle_id: id,
      user_id: userId,
      status: circle.requires_approval ? "pending" : "joined",
      join_answer: answer ?? null,
    });
    load();
  };

  const handleJoinToggle = async () => {
    if (!userId) return;
    if (myStatus) {
      await supabase.from("circle_members").delete().eq("circle_id", id).eq("user_id", userId);
      load();
      return;
    }
    if (circle.join_question) {
      setShowJoinQuestion(true);
      return;
    }
    doJoin();
  };

  const handleApprove = async (memberId: string) => {
    await supabase.from("circle_members").update({ status: "joined" }).eq("id", memberId);
    load();
  };

  const handleReject = async (memberId: string) => {
    await supabase.from("circle_members").delete().eq("id", memberId);
    load();
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !userId) return;
    await supabase.from("circle_comments").insert({
      circle_id: id,
      user_id: userId,
      message: newComment.trim(),
    });
    setNewComment("");
    load();
  };

  const handleSetStatus = async (status: string) => {
    await supabase.from("circles").update({ status }).eq("id", id);
    setShowHostMenu(false);
    load();
  };

  const handleToggleApproval = async () => {
    await supabase.from("circles").update({ requires_approval: !circle.requires_approval }).eq("id", id);
    setShowHostMenu(false);
    load();
  };

  const handleCopyInvite = () => {
    const url = `${location.origin}/join/${circle.invite_code}`;
    navigator.clipboard.writeText(url);
    alert("Link undangan disalin: " + url);
    setShowHostMenu(false);
  };

  const handleDeleteCircle = async () => {
    if (!confirm("Yakin mau hapus circle ini? Semua data line up dan komentar akan ikut terhapus dan tidak bisa dikembalikan.")) {
      return;
    }
    const coverPath = extractStoragePath(circle.cover_url, "circle-covers");
    await supabase.from("circles").delete().eq("id", id);
    if (coverPath) {
      await supabase.storage.from("circle-covers").remove([coverPath]);
    }
    router.push("/my-circle");
  };

  if (!circle) return <p className="p-6 text-gray-400">Memuat...</p>;

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-40 bg-gray-200 rounded-2xl overflow-hidden relative">
          {(() => {
            const cover = resolveCircleCover(defaultCoverMap, circle.category, circle.cover_url);
            return cover && <img src={cover} alt={circle.name} className="w-full h-full object-cover" />;
          })()}
          {(() => {
            const displayStatus = getCircleDisplayStatus(circle);
            const info = STATUS_LABEL[displayStatus];
            return (
              <span className={`absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-full ${info.className}`}>
                {info.label}
              </span>
            );
          })()}
        </div>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{circle.name}</h1>
              {circle.is_circle_plus && (
                <span className="text-xs bg-primary text-white px-2 py-1 rounded-full">Circle+</span>
              )}
            </div>
            {circle.group_name && <p className="text-sm text-gray-400">{circle.group_name}</p>}
          </div>

          {isHost && (
            <div className="relative">
              <button
                onClick={() => setShowHostMenu((s) => !s)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Pengaturan Circle"
              >
                <MoreVertical size={20} />
              </button>
              {showHostMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white border rounded-xl shadow-lg overflow-hidden z-50">
                  <button
                    onClick={() => handleSetStatus("completed")}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b"
                  >
                    Tandai Selesai
                  </button>
                  <button
                    onClick={() => handleSetStatus("cancelled")}
                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-b"
                  >
                    Batalkan Circle
                  </button>
                  <button
                    onClick={handleToggleApproval}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b"
                  >
                    {circle.requires_approval ? "Matikan" : "Aktifkan"} Perlu Approval Join
                  </button>
                  {circle.invite_code && (
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
        </div>

        <p className="text-gray-500">{circle.description}</p>

        {host && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <img
              src={host.avatar_url || "https://ui-avatars.com/api/?name=" + (host.full_name || "U")}
              className="w-6 h-6 rounded-full object-cover"
              alt=""
            />
            <span>Dibuat oleh {host.nickname || host.full_name}</span>
          </div>
        )}

        <div className="text-sm text-gray-500 space-y-1">
          {circle.city && <p>🏙️ {circle.city}</p>}
          <p>📍 {circle.location}</p>
          <p>🏷️ {circle.category}</p>
          <p>🗓️ {new Date(circle.event_date).toLocaleString("id-ID")}</p>
          {circle.max_participants && <p>👥 Maks {circle.max_participants} orang</p>}
          {circle.is_private && <p>🔒 Private / Invite Only</p>}
          {circle.requires_approval && <p>✅ Perlu persetujuan host untuk join</p>}
        </div>

        {circle.max_participants && (
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
      </div>

      {/* Join button */}
      {!isHost && (() => {
        const displayStatus = getCircleDisplayStatus(circle);
        if (displayStatus === "completed" || displayStatus === "cancelled") {
          return (
            <button disabled className="w-full rounded-xl py-3 font-medium bg-gray-100 text-gray-400 cursor-not-allowed">
              {displayStatus === "completed" ? "Circle sudah selesai" : "Circle dibatalkan"}
            </button>
          );
        }
        return (
          <button
            onClick={handleJoinToggle}
            disabled={myStatus === "pending"}
            className={`w-full rounded-xl py-3 font-medium ${
              myStatus === "joined"
                ? "bg-red-50 text-red-600 border border-red-300"
                : myStatus === "pending"
                ? "bg-gray-100 text-gray-400"
                : "bg-primary text-white"
            }`}
          >
            {myStatus === "joined" ? "Batal Join" : myStatus === "pending" ? "Menunggu Persetujuan" : "Join Circle"}
          </button>
        );
      })()}

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

      {/* Approval requests untuk host */}
      {isHost && pendingMembers.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-gray-700">Menunggu Persetujuan ({pendingMembers.length})</h3>
          {pendingMembers.map((m) => (
            <div key={m.id} className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-3">
                <img
                  src={m.profile?.avatar_url || "https://ui-avatars.com/api/?name=" + (m.profile?.full_name || "U")}
                  className="w-10 h-10 rounded-full object-cover"
                  alt=""
                />
                <p className="flex-1 font-medium">{m.profile?.nickname || m.profile?.full_name}</p>
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

      {/* Tabs */}
      <div className="flex border-b">
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
          }}
          className={`relative flex-1 py-2 font-medium ${tab === "chat" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Komen Grup
          {hasNewComment && (
            <span className="absolute top-1 right-1/4 w-2.5 h-2.5 bg-red-500 rounded-full" />
          )}
        </button>
      </div>

      {tab === "lineup" && (
        <div className="space-y-3">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => isJoined && setSelectedMember(m.profile)}
              className="w-full flex items-center gap-3 border rounded-xl p-3 text-left hover:bg-gray-50"
            >
              <img
                src={m.profile?.avatar_url || "https://ui-avatars.com/api/?name=" + (m.profile?.full_name || "U")}
                className="w-10 h-10 rounded-full object-cover"
                alt=""
              />
              <div>
                <p className="font-medium">{m.profile?.nickname || m.profile?.full_name}</p>
                {isJoined && <p className="text-xs text-gray-400">Lihat profil</p>}
              </div>
            </button>
          ))}
          {!members.length && <p className="text-gray-400 text-sm">Belum ada yang join.</p>}
        </div>
      )}

      {tab === "chat" && (
        <div className="space-y-3">
          {isJoined ? (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto">
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
                          <p className="text-xs font-semibold mb-1 opacity-70">{c.profile?.full_name}</p>
                        )}
                        <p className="text-sm">{c.message}</p>
                      </div>
                    </div>
                  );
                })}
                {!comments.length && <p className="text-gray-400 text-sm">Belum ada komentar.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-xl px-4 py-2"
                  placeholder="Tulis komentar..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
                />
                <button onClick={handleSendComment} className="bg-primary text-white px-4 rounded-xl">
                  Kirim
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Join circle ini dulu untuk ikut chat.</p>
          )}
        </div>
      )}

      {selectedMember && (
        <MemberProfileModal profile={selectedMember} onClose={() => setSelectedMember(null)} />
      )}
    </div>
  );
}
