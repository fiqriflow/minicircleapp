"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bug, Lightbulb, MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Category = "bug" | "feature" | "other";

const CATEGORIES: { value: Category; label: string; icon: any }[] = [
  { value: "bug", label: "Bug/Error", icon: Bug },
  { value: "feature", label: "Fitur yang Diinginkan", icon: Lightbulb },
  { value: "other", label: "Lainnya", icon: MoreHorizontal },
];

export default function MasukanPage() {
  const supabase = createClient();
  const router = useRouter();
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
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
      is_anonymous: isAnonymous,
      category,
      source: "masukan",
    });

    setSending(false);
    if (error) {
      alert("Gagal mengirim masukan: " + error.message);
      return;
    }

    setSent(true);
    setMessage("");
    setIsAnonymous(false);
  };

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800" aria-label="Kembali">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">Masukan</h1>
      </div>

      {sent ? (
        <div className="bg-white rounded-2xl border p-6 text-center space-y-2">
          <p className="font-medium">Terima kasih!</p>
          <p className="text-sm text-gray-500">Masukan kamu sudah kami terima.</p>
          <button onClick={() => setSent(false)} className="text-sm text-primary font-medium mt-2">
            Kirim masukan lain
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500">Kategori</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {CATEGORIES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`flex flex-col items-center gap-1 border rounded-xl py-3 px-1 text-center ${
                    category === value ? "border-primary bg-primary/5 text-primary" : "text-gray-500"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-xs font-medium leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500">Masukan / Saran / Kendala</label>
            <textarea
              className="w-full border rounded-xl px-4 py-2 mt-1 min-h-[140px]"
              placeholder="Tulis masukan, saran, atau kendala yang kamu alami..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            Kirim sebagai anonim
          </label>

          <button
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
            className="w-full bg-primary text-white rounded-xl py-3 font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {sending ? "Mengirim..." : "Kirim Masukan"}
          </button>
        </div>
      )}
    </div>
  );
}
