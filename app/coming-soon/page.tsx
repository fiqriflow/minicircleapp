"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ComingSoonPage() {
  const router = useRouter();
  const supabase = createClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSending(false);
      return;
    }

    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      message: message.trim(),
      is_anonymous: false,
      category: "feature",
      source: "circle_plus_coming_soon",
    });

    setSending(false);
    if (!error) {
      setSent(true);
      setMessage("");
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 space-y-4">
      <Sparkles size={48} className="text-primary" />
      <h1 className="text-xl font-bold">Segera Hadir</h1>
      <p className="text-gray-500 max-w-sm">
        Fitur Circle+ sedang belum tersedia saat ini. Nantikan pembaruannya ya!
      </p>

      <div className="w-full max-w-sm bg-white border rounded-2xl p-4 text-left space-y-3">
        {sent ? (
          <p className="text-sm text-gray-600 text-center py-2">
            Terima kasih! Masukan kamu soal Circle+ udah kami catat.
          </p>
        ) : (
          <>
            <p className="text-sm font-medium">Ada fitur yang kamu harapkan ada di Circle+?</p>
            <textarea
              className="w-full border rounded-xl px-3 py-2 text-sm min-h-[100px]"
              placeholder="Ceritain fitur yang kamu inginkan di Circle+..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              onClick={handleSubmit}
              disabled={sending || !message.trim()}
              className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {sending ? "Mengirim..." : "Kirim Masukan"}
            </button>
          </>
        )}
      </div>

      <button onClick={() => router.back()} className="text-primary font-medium underline">
        Kembali
      </button>
    </div>
  );
}
