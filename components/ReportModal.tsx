"use client";

import { useState } from "react";
import { X, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const CIRCLE_REASONS = [
  "Spam atau promosi",
  "Konten tidak pantas",
  "Penipuan",
  "Info circle menyesatkan",
  "Lainnya",
];

const USER_REASONS = [
  "Pelecehan / perilaku tidak pantas",
  "Akun palsu / penyamaran",
  "Spam atau promosi",
  "Penipuan",
  "Sering tidak hadir tanpa kabar (no-show)",
  "Lainnya",
];

export default function ReportModal({
  targetType,
  targetName,
  targetCircleId,
  targetUserId,
  onClose,
}: {
  targetType: "circle" | "user";
  targetName?: string;
  targetCircleId?: string;
  targetUserId?: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const reasons = targetType === "circle" ? CIRCLE_REASONS : USER_REASONS;
  const [reason, setReason] = useState(reasons[0]);
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSending(false);
      toast.error("Kamu harus login untuk membuat laporan.");
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_circle_id: targetType === "circle" ? targetCircleId : null,
      target_user_id: targetType === "user" ? targetUserId : null,
      reason,
      description: description.trim() || null,
    });

    setSending(false);
    if (error) {
      toast.error("Gagal mengirim laporan: " + error.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 relative">
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700" aria-label="Tutup">
          <X size={20} />
        </button>

        {sent ? (
          <div className="text-center space-y-2 py-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Flag size={22} />
            </div>
            <p className="font-medium">Laporan terkirim</p>
            <p className="text-sm text-gray-500">
              Terima kasih, tim kami akan meninjau laporan ini secepatnya.
            </p>
            <button onClick={onClose} className="text-sm text-primary font-medium mt-2">
              Tutup
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 pr-6">
              <Flag size={18} className="text-red-500 shrink-0" />
              <h3 className="font-bold">
                Laporkan {targetType === "circle" ? "Circle" : "Pengguna"}
                {targetName ? `: ${targetName}` : ""}
              </h3>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-500">Alasan</label>
              <div className="space-y-1.5">
                {reasons.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm cursor-pointer ${
                      reason === r ? "border-primary bg-primary/5" : "text-gray-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="accent-primary"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500">Detail tambahan (opsional)</label>
              <textarea
                className="w-full border rounded-xl px-4 py-2 mt-1 min-h-[90px] text-sm"
                placeholder="Ceritakan detail kejadian..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={sending}
              className="w-full bg-red-500 text-white rounded-xl py-3 font-medium hover:bg-red-600 disabled:opacity-50"
            >
              {sending ? "Mengirim..." : "Kirim Laporan"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
