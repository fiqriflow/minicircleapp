import Link from "next/link";
import {
  Users, Search, CalendarCheck, ShieldCheck, Zap, Bell, UserCheck, ChevronDown,
} from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import LottieMascot from "@/components/ui/LottieMascot";

// Landing page publik (bisa dibuka tanpa login), diakses dari halaman /login.
export const metadata = {
  title: "Mincle — Buat dan temukan circlemu",
  description: "Cari teman beraktivitas: gowes, jalan santai, jogging, renang, dan explore alam. Gabung atau buat circle-mu sendiri.",
};

const STEPS = [
  { icon: UserCheck, title: "Daftar dengan Google", body: "Lengkapi profil singkat: foto dan Instagram, supaya semua orang di circle saling percaya." },
  { icon: Search, title: "Cari atau buat circle", body: "Pilih circle sesuai aktivitas, kota, dan jadwal. Atau buat circle sendiri dalam beberapa langkah." },
  { icon: CalendarCheck, title: "Ketemu & beraktivitas", body: "Datang di titik kumpul, check-in, dan nikmati aktivitasnya bareng teman baru." },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Profil asli", body: "Foto profil dan Instagram wajib diisi. Akun terverifikasi diberi centang biru." },
  { icon: Users, title: "Host yang atur", body: "Host bisa pakai approval, pertanyaan join, dan batasan peserta untuk menjaga circle tetap nyaman." },
  { icon: Zap, title: "Sistem energy", body: "Setiap orang mendapat 1000 energy yang di-reset tiap Senin. Gabung dan buat circle memakai energy, jadi semua serius datang." },
  { icon: Bell, title: "Notifikasi & pengingat", body: "Dapat kabar saat permintaan join diterima, ada pengumuman host, atau circle akan dimulai." },
];

const FAQ = [
  { q: "Apakah Mincle gratis?", a: "Ya. Daftar dan memakai Mincle gratis. Biaya kegiatan (jika ada) disepakati antara host dan peserta." },
  { q: "Siapa yang boleh daftar?", a: "Pengguna berusia minimal 17 tahun. Kamu masuk lewat akun Google, tanpa kata sandi baru." },
  { q: "Apa itu energy?", a: "Poin yang dipakai untuk join (100) dan membuat circle (100, Circle+ 200). Tidak hadir tanpa check-in dikenai pengurangan 50. Energy kembali ke 1000 tiap Senin." },
];

export default function LandingPage() {
  return (
    <div className="bg-white text-gray-800">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <img src="/logo-login.svg" alt="Mincle" className="h-9" />
        <Link href="/login" className="text-sm font-bold text-primary border-2 border-primary rounded-xl px-4 py-1.5">
          Masuk
        </Link>
      </header>

      {/* Hero */}
      <section className="px-6 pt-8 pb-6 text-center space-y-4 bg-gradient-to-b from-primary/10 to-white">
        <h1 className="text-3xl font-extrabold leading-tight">
          Cari teman beraktivitas,<br />
          <span className="text-primary">bareng-bareng.</span>
        </h1>
        <p className="text-gray-500">
          Gabung circle gowes, jogging, renang, dan explore alam di sekitarmu. Atau buat circle-mu sendiri.
        </p>
        <LottieMascot src="/login.json" className="w-[75%] max-w-[300px] aspect-[489/314] mx-auto" />
        <Link
          href="/login"
          className="block w-full bg-primary text-white rounded-xl py-3 font-bold"
        >
          Mulai Sekarang
        </Link>
        <a href="#cara-kerja" className="inline-flex items-center gap-1 text-sm text-gray-400">
          Lihat cara kerjanya <ChevronDown size={14} />
        </a>
      </section>

      {/* Aktivitas */}
      <section className="px-6 py-6 space-y-3">
        <h2 className="text-xl font-extrabold">Aktivitas yang ada</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(({ label, icon: Icon }) => (
            <span key={label} className="flex items-center gap-2 border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm font-bold text-gray-600">
              <Icon size={18} className="text-primary" />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* Cara kerja */}
      <section id="cara-kerja" className="px-6 py-6 space-y-3 scroll-mt-16">
        <h2 className="text-xl font-extrabold">Cara kerjanya</h2>
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex gap-3 border-2 border-gray-200 rounded-2xl p-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <s.icon size={20} />
              </div>
              <div>
                <p className="font-extrabold">
                  {i + 1}. {s.title}
                </p>
                <p className="text-sm text-gray-500">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Kenapa Mincle */}
      <section className="px-6 py-6 space-y-3 bg-gray-50">
        <h2 className="text-xl font-extrabold">Kenapa Mincle?</h2>
        <div className="grid grid-cols-1 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3 bg-white border rounded-2xl p-4">
              <f.icon size={22} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold">{f.title}</p>
                <p className="text-sm text-gray-500">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-6 space-y-3">
        <h2 className="text-xl font-extrabold">Pertanyaan umum</h2>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-2 border-gray-200 rounded-2xl px-4 py-3">
              <summary className="flex items-center justify-between cursor-pointer font-bold list-none">
                {f.q}
                <ChevronDown size={18} className="text-gray-400 transition-transform group-open:rotate-180 shrink-0" />
              </summary>
              <p className="text-sm text-gray-500 mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA akhir */}
      <section className="px-6 py-8 text-center space-y-3 bg-primary/10">
        <h2 className="text-2xl font-extrabold">Siap cari circle pertamamu?</h2>
        <Link href="/login" className="block w-full bg-primary text-white rounded-xl py-3 font-bold">
          Daftar / Masuk dengan Google
        </Link>
      </section>

      <footer className="px-6 py-6 text-center text-xs text-gray-400 space-y-2">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <Link href="/profile/syarat-ketentuan" className="underline">Syarat &amp; Ketentuan</Link>
          <Link href="/profile/kebijakan-privasi" className="underline">Kebijakan Privasi</Link>
          <Link href="/profile/panduan-komunitas" className="underline">Panduan Komunitas</Link>
        </div>
        <p>© {new Date().getFullYear()} Mincle</p>
      </footer>
    </div>
  );
}
