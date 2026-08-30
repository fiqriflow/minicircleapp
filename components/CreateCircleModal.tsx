"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CATEGORY_OPTIONS = ["Running", "Jalan Santai", "Gowes"];

const emptyForm = {
  name: "",              // Nama Event
  group_name: "",         // Nama Grup
  max_participants: 5,    // Jumlah Orang 5-10
  category: "Running",
  location: "",           // Titik Kumpul
  event_date: "",         // Tanggal & Jam
  description: "",        // Rundown / Detail Kegiatan
};

export default function CreateCircleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.name || !form.group_name || !form.location || !form.event_date) {
      setError("Lengkapi semua field wajib dulu ya.");
      return;
    }
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("circles").insert({
      ...form,
      status: "active",
      created_by: user?.id,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg">Buat Circle Baru</h2>

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
          <label className="text-sm text-gray-500">Jumlah Orang (5-10)</label>
          <input
            type="number"
            min={5}
            max={10}
            className="w-full border rounded-xl px-3 py-2"
            value={form.max_participants}
            onChange={(e) =>
              setForm({ ...form, max_participants: Math.min(10, Math.max(5, Number(e.target.value))) })
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
