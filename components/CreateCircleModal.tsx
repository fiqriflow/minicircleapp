"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { generateInviteCode } from "@/lib/inviteCode";

const CATEGORY_OPTIONS = ["Running", "Jalan Santai", "Gowes"];

export default function CreateCircleModal({
  circleType,
  onClose,
  onCreated,
}: {
  circleType: "regular" | "plus";
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const isPlus = circleType === "plus";
  const minP = 3;
  const maxP = isPlus ? 12 : 6;

  const [form, setForm] = useState({
    name: "",
    group_name: "",
    max_participants: isPlus ? 8 : 5,
    category: "Running",
    location: "",
    event_date: "",
    description: "",
    cover_url: "",
    is_private: false,
    invite_code: "",
    join_question: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState("");
  const [host, setHost] = useState<any>(null);

  useEffect(() => {
    const loadHost = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, nickname, avatar_url").eq("id", user.id).single();
      setHost(data);
    };
    loadHost();
  }, []);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("circle-covers").upload(path, file, { upsert: true });
    if (uploadError) {
      alert("Gagal upload cover: " + uploadError.message);
      setUploadingCover(false);
      return;
    }
    const { data } = supabase.storage.from("circle-covers").getPublicUrl(path);
    setForm((f) => ({ ...f, cover_url: data.publicUrl }));
    setUploadingCover(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.group_name || !form.location || !form.event_date) {
      setError("Lengkapi semua field wajib dulu ya.");
      return;
    }
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();

    const payload: any = {
      name: form.name,
      group_name: form.group_name,
      max_participants: form.max_participants,
      category: form.category,
      location: form.location,
      event_date: form.event_date,
      description: form.description,
      status: "active",
      created_by: user?.id,
      is_circle_plus: isPlus,
    };

    if (isPlus) {
      payload.cover_url = form.cover_url || null;
      payload.is_private = form.is_private;
      payload.invite_code = (form.invite_code.trim() || generateInviteCode()).toUpperCase();
      payload.join_question = form.join_question.trim() || null;
    }

    const { data: newCircle, error: insertError } = await supabase
      .from("circles")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      setSaving(false);
      setError(
        insertError.message.includes("duplicate")
          ? "Kode undangan sudah dipakai, coba kode lain."
          : insertError.message
      );
      return;
    }

    // host otomatis masuk line up
    if (newCircle && user) {
      await supabase.from("circle_members").insert({
        circle_id: newCircle.id,
        user_id: user.id,
        status: "joined",
      });
    }

    setSaving(false);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg">
          Buat {isPlus ? "Circle+" : "Circle"} Baru
        </h2>

        {host && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
            <img
              src={host.avatar_url || "https://ui-avatars.com/api/?name=" + (host.full_name || "U")}
              className="w-8 h-8 rounded-full object-cover"
              alt=""
            />
            <div>
              <p className="text-xs text-gray-400">Host / Pembuat Circle</p>
              <p className="text-sm font-medium">{host.nickname || host.full_name}</p>
            </div>
          </div>
        )}

        {isPlus && (
          <div className="space-y-1">
            <label className="text-sm text-gray-500">Custom Cover</label>
            <div className="h-32 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
              {form.cover_url ? (
                <img src={form.cover_url} alt="cover" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 text-sm">Belum ada cover</span>
              )}
            </div>
            <label className="text-sm text-primary font-medium cursor-pointer inline-block">
              {uploadingCover ? "Mengunggah..." : "Upload Cover"}
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
            </label>
          </div>
        )}

        <div>
          <label className="text-sm text-gray-500">Nama Event</label>
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Mis. Gowes Pagi Akhir Pekan"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">Nama Grup</label>
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Mis. Circle Sepeda Santai"
            value={form.group_name}
            onChange={(e) => setForm({ ...form, group_name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">Jumlah Orang ({minP}-{maxP})</label>
          <input
            type="number"
            min={minP}
            max={maxP}
            className="w-full border rounded-xl px-3 py-2"
            value={form.max_participants}
            onChange={(e) =>
              setForm({ ...form, max_participants: Math.min(maxP, Math.max(minP, Number(e.target.value))) })
            }
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">Kategori Circle</label>
          <select
            className="w-full border rounded-xl px-3 py-2"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-500">Titik Kumpul</label>
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Mis. Taman Kota, Gerbang Utara"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">Tanggal & Jam</label>
          <input
            type="datetime-local"
            className="w-full border rounded-xl px-3 py-2"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-gray-500">Rundown / Detail Kegiatan</label>
          <textarea
            className="w-full border rounded-xl px-3 py-2"
            rows={3}
            placeholder="Mis. Kumpul 06.00, briefing, gowes 15km, sarapan bareng"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        {isPlus && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_private}
                onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
              />
              Private / Invite Only (tidak tampil di Explore, hanya bisa join lewat link undangan)
            </label>

            <div>
              <label className="text-sm text-gray-500">Custom Invite Link (opsional)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 whitespace-nowrap">/join/</span>
                <input
                  className="w-full border rounded-xl px-3 py-2 uppercase"
                  placeholder="Otomatis kalau dikosongkan"
                  value={form.invite_code}
                  onChange={(e) => setForm({ ...form, invite_code: e.target.value.replace(/\s/g, "") })}
                  maxLength={20}
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500">Pertanyaan saat Join (opsional)</label>
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder="Mis. Sudah pernah gowes berapa km?"
                value={form.join_question}
                onChange={(e) => setForm({ ...form, join_question: e.target.value })}
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-3 text-gray-500">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary text-white rounded-xl py-3 font-medium"
          >
            {saving ? "Menyimpan..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
