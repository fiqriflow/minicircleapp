"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { INITIAL_ENERGY, DAILY_ENERGY_BONUS, ENERGY_COST } from "@/lib/energy";
import { isPushSupported, subscribeToPush, setPushOptOut } from "@/lib/push";

const FLAG_KEY = "mincle_show_welcome";

// Tur pengenalan singkat: muncul sekali setelah onboarding selesai (flag di sessionStorage
// diset oleh /onboarding). Angka energy diambil dari lib/energy supaya selalu sinkron.
const SLIDES = [
  {
    emoji: "🔍",
    title: "Cari & Join Circle",
    body: `Buka Explore, filter berdasarkan kategori dan kota, lalu join circle yang cocok. Join butuh ${ENERGY_COST.join} energy. Beberapa circle perlu persetujuan host dulu.`,
  },
  {
    emoji: "🏸",
    title: "Buat Circle Sendiri",
    body: `Ajak orang main bareng: atur jadwal, lokasi, dan jumlah slot. Buat circle butuh ${ENERGY_COST.create} energy (Circle+ ${ENERGY_COST.createPlus}) dan kamu jadi host-nya.`,
  },
  {
    emoji: "⚡",
    title: "Energy",
    body: `Energy dipakai untuk join dan buat circle. Kamu mulai dengan ${INITIAL_ENERGY} energy dan dapat bonus +${DAILY_ENERGY_BONUS} tiap hari (00.00 WIB).`,
  },
  {
    emoji: "✅",
    title: "Check-in Itu Penting",
    body: "Saat circle dimulai, tekan Check-in. Kalau lupa atau tidak hadir, energy kamu dikurangi 1 dan host bisa tahu.",
  },
];

export default function WelcomeDialog() {
  const [name, setName] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 0 = sambutan, 1..SLIDES.length = slide, terakhir = notifikasi
  const [canAskPush, setCanAskPush] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLAG_KEY);
      if (raw) {
        setName(raw);
        sessionStorage.removeItem(FLAG_KEY);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    (async () => {
      const ok = (await isPushSupported()) && "Notification" in window && Notification.permission === "default";
      if (!cancelled) setCanAskPush(ok);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!name) return null;

  const lastStep = SLIDES.length + 1; // slide notifikasi
  const close = () => setName(null);

  const enablePush = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await subscribeToPush(); // dari tap user -> aman untuk iOS
      if (res.ok) {
        setPushOptOut(false);
        toast.success("Notifikasi aktif");
      } else if (res.reason === "permission_denied") {
        toast.error("Izin notifikasi ditolak. Bisa diaktifkan lagi di menu Profil.");
      } else {
        toast.error("Gagal mengaktifkan notifikasi. Coba lagi dari menu Profil.");
      }
    } catch {
      toast.error("Gagal mengaktifkan notifikasi. Coba lagi dari menu Profil.");
    } finally {
      setBusy(false);
      close();
    }
  };

  const slide = step >= 1 && step <= SLIDES.length ? SLIDES[step - 1] : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center space-y-4 relative">
        {step < lastStep && (
          <button onClick={close} className="absolute top-3 right-4 text-xs text-gray-400 hover:text-gray-600">
            Lewati
          </button>
        )}

        {step === 0 && (
          <>
            <img src="/mascotsukses.svg" alt="Berhasil" className="w-40 h-40 mx-auto" />
            <div>
              <h2 className="text-xl font-bold">Selamat Datang, {name}! 🎉</h2>
              <p className="text-sm text-gray-500 mt-1">Kenalan singkat sama Mincle dulu yuk, cuma 30 detik.</p>
            </div>
          </>
        )}

        {slide && (
          <div className="pt-4 space-y-3">
            <div className="text-6xl">{slide.emoji}</div>
            <h2 className="text-lg font-bold">{slide.title}</h2>
            <p className="text-sm text-gray-500">{slide.body}</p>
          </div>
        )}

        {step === lastStep && (
          <div className="space-y-3">
            <div className="text-6xl">🔔</div>
            <h2 className="text-lg font-bold">Jangan Ketinggalan Info</h2>
            <p className="text-sm text-gray-500">
              Aktifkan notifikasi untuk tahu soal pelamar baru, komentar, pengumuman host, dan slot yang kosong.
              {!canAskPush && " Kamu bisa mengaturnya kapan saja di menu Profil."}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-1.5">
          {Array.from({ length: lastStep + 1 }).map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-primary" : "w-1.5 bg-gray-200"}`} />
          ))}
        </div>

        <div className="space-y-2">
          {step < lastStep ? (
            <button onClick={() => setStep(step + 1)} className="w-full bg-primary text-white rounded-xl py-3 font-medium">
              {step === 0 ? "Mulai Kenalan" : "Lanjut"}
            </button>
          ) : canAskPush ? (
            <>
              <button
                onClick={enablePush}
                disabled={busy}
                className="w-full bg-primary text-white rounded-xl py-3 font-medium disabled:opacity-50"
              >
                {busy ? "Memproses..." : "Aktifkan Notifikasi"}
              </button>
              <button onClick={close} className="w-full text-sm text-gray-500 py-2">
                Nanti saja
              </button>
            </>
          ) : (
            <button onClick={close} className="w-full bg-primary text-white rounded-xl py-3 font-medium">
              Mulai Explore
            </button>
          )}
          {step > 0 && step < lastStep && (
            <button onClick={() => setStep(step - 1)} className="w-full text-sm text-gray-500 py-1">
              Kembali
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
