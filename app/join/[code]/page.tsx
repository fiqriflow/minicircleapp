"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import JoinQuestionModal from "@/components/JoinQuestionModal";

export default function JoinByInvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [circle, setCircle] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [showJoinQuestion, setShowJoinQuestion] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: c } = await supabase
        .from("circles")
        .select("*")
        .eq("invite_code", (code as string).toUpperCase())
        .single();

      if (!c) {
        setNotFound(true);
        return;
      }
      setCircle(c);

      if (user) {
        const { data: existing } = await supabase
          .from("circle_members")
          .select("id")
          .eq("circle_id", c.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (existing) setAlreadyMember(true);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const doJoin = async (answer?: string) => {
    if (!userId || !circle) return;
    await supabase.from("circle_members").insert({
      circle_id: circle.id,
      user_id: userId,
      status: circle.requires_approval ? "pending" : "joined",
      join_answer: answer ?? null,
    });
    router.push(`/circle/${circle.id}`);
  };

  const handleJoinClick = () => {
    if (circle.join_question) {
      setShowJoinQuestion(true);
      return;
    }
    doJoin();
  };

  if (notFound) {
    return (
      <div className="p-6 text-center space-y-2">
        <p className="text-gray-500">Link undangan tidak valid atau sudah tidak berlaku.</p>
      </div>
    );
  }

  if (!circle) return <p className="p-6 text-gray-400">Memuat...</p>;

  return (
    <div className="px-4 py-10 space-y-4 text-center">
      <div className="h-40 bg-gray-200 rounded-2xl overflow-hidden">
        {circle.cover_url && (
          <img src={circle.cover_url} alt={circle.name} className="w-full h-full object-cover" />
        )}
      </div>
      <h1 className="text-xl font-bold">{circle.name}</h1>
      <p className="text-gray-500">{circle.group_name}</p>
      <div className="text-sm text-gray-500 space-y-1">
        <p>📍 {circle.location}</p>
        <p>🗓️ {new Date(circle.event_date).toLocaleString("id-ID")}</p>
      </div>

      {alreadyMember ? (
        <button
          onClick={() => router.push(`/circle/${circle.id}`)}
          className="w-full bg-primary text-white rounded-xl py-3 font-medium"
        >
          Buka Circle
        </button>
      ) : (
        <button onClick={handleJoinClick} className="w-full bg-primary text-white rounded-xl py-3 font-medium">
          Gabung Circle Ini
        </button>
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
    </div>
  );
}
