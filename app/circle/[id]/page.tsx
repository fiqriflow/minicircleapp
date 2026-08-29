"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [circle, setCircle] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [tab, setTab] = useState<"lineup" | "chat">("lineup");
  const [newComment, setNewComment] = useState("");

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data: c } = await supabase.from("circles").select("*").eq("id", id).single();
    setCircle(c);

    const { data: m } = await supabase
      .from("circle_members")
      .select("*, profile:profiles(full_name, nickname, avatar_url)")
      .eq("circle_id", id);
    setMembers(m ?? []);
    setIsJoined(!!m?.some((row) => row.user_id === user?.id));

    if (m?.some((row) => row.user_id === user?.id)) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleJoinToggle = async () => {
    if (!userId) return;
    if (isJoined) {
      await supabase.from("circle_members").delete().eq("circle_id", id).eq("user_id", userId);
    } else {
      await supabase.from("circle_members").insert({ circle_id: id, user_id: userId });
    }
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

  if (!circle) return <p className="p-6 text-gray-400">Memuat...</p>;

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-40 bg-gray-200 rounded-2xl overflow-hidden">
          {circle.cover_url && (
            <img src={circle.cover_url} alt={circle.name} className="w-full h-full object-cover" />
          )}
        </div>
        <h1 className="text-2xl font-bold">{circle.name}</h1>
        <p className="text-gray-500">{circle.description}</p>
        <div className="text-sm text-gray-500 space-y-1">
          <p>📍 {circle.location}</p>
          <p>🏷️ {circle.category}</p>
          <p>🗓️ {new Date(circle.event_date).toLocaleString("id-ID")}</p>
        </div>
      </div>

      {/* Join button */}
      <button
        onClick={handleJoinToggle}
        className={`w-full rounded-xl py-3 font-medium ${
          isJoined ? "bg-red-50 text-red-600 border border-red-300" : "bg-primary text-white"
        }`}
      >
        {isJoined ? "Batal Join" : "Join Circle"}
      </button>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setTab("lineup")}
          className={`flex-1 py-2 font-medium ${tab === "lineup" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Line Up ({members.length})
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 py-2 font-medium ${tab === "chat" ? "border-b-2 border-primary text-primary" : "text-gray-400"}`}
        >
          Komen Grup
        </button>
      </div>

      {tab === "lineup" && (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 border rounded-xl p-3">
              <img
                src={m.profile?.avatar_url || "https://ui-avatars.com/api/?name=" + (m.profile?.full_name || "U")}
                className="w-10 h-10 rounded-full object-cover"
                alt=""
              />
              <div>
                <p className="font-medium">{m.profile?.nickname || m.profile?.full_name}</p>
              </div>
            </div>
          ))}
          {!members.length && <p className="text-gray-400 text-sm">Belum ada yang join.</p>}
        </div>
      )}

      {tab === "chat" && (
        <div className="space-y-3">
          {isJoined ? (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="bg-white border rounded-xl p-3">
                    <p className="text-sm font-medium">{c.profile?.full_name}</p>
                    <p className="text-sm text-gray-600">{c.message}</p>
                  </div>
                ))}
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
    </div>
  );
}
