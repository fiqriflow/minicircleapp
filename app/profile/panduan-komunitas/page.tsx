"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, Flag } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="font-semibold text-gray-800">{title}</h2>
      <div className="text-sm text-gray-600 space-y-2">{children}</div>
    </div>
  );
}

function PanduanKomunitasPageContent() {
  const router = useRouter();
  const isEmbed = useSearchParams().get("embed") === "1";

  return (
    <div>
      {!isEmbed && (
        <div className="sticky top-0 z-10 bg-white border-b flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800" aria-label="Kembali">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-bold">Panduan Komunitas</h1>
        </div>
      )}

      <div className="px-4 py-6 space-y-6 pb-16">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-3 items-start">
        <ShieldCheck size={20} className="text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700">
          Mincle dibuat untuk bikin aktivitas bareng — olahraga, kulineran, explore alam, dan
          lainnya — jadi lebih gampang dan menyenangkan. Ikuti panduan ini supaya komunitas tetap aman,
          ramah, dan nyaman buat semua orang.
        </p>
      </div>

      <div className="bg-white rounded-2xl border p-4 space-y-6">
        <Section title="1. Bersikap Ramah &amp; Hormati Sesama">
          <ul className="list-disc pl-4 space-y-1">
            <li>Perlakukan semua anggota circle dengan sopan, apa pun latar belakang, gender, atau kemampuan olahraganya.</li>
            <li>Tidak ada tempat untuk pelecehan, ujaran kebencian, perundungan, atau ancaman dalam bentuk apa pun.</li>
            <li>Hormati batas dan kenyamanan orang lain, baik saat chat maupun bertemu langsung.</li>
          </ul>
        </Section>

        <Section title="2. Jujur dengan Profil &amp; Info Circle">
          <ul className="list-disc pl-4 space-y-1">
            <li>Gunakan foto dan data profil yang mencerminkan dirimu sebenarnya — jangan menyamar sebagai orang lain.</li>
            <li>Sebagai host, tulis informasi circle yang akurat: jenis aktivitas, lokasi, waktu, tingkat kesulitan/jarak tempuh, dan jumlah slot.</li>
            <li>Jangan gunakan circle untuk promosi/jualan/spam yang tidak relevan dengan tujuan aktivitas bareng.</li>
          </ul>
        </Section>

        <Section title="3. Komitmen &amp; Tepat Waktu">
          <ul className="list-disc pl-4 space-y-1">
            <li>Kalau sudah join circle, usahakan hadir. Kalau berhalangan, batalkan join lebih awal supaya slot bisa diisi orang lain.</li>
            <li>Sebagai host, konfirmasi dan kelola peserta dengan adil, terutama circle yang perlu approval.</li>
            <li>No-show berulang tanpa kabar bisa dilaporkan oleh anggota circle lain.</li>
          </ul>
        </Section>

        <Section title="4. Utamakan Keselamatan">
          <ul className="list-disc pl-4 space-y-1">
            <li>Untuk pertemuan pertama kali, pilih titik kumpul di tempat umum dan ramai.</li>
            <li>Beri tahu keluarga/teman soal rencana dan lokasi aktivitasmu.</li>
            <li>Kenali batas kemampuanmu sendiri dan sesuaikan dengan jenis circle yang kamu ikuti:</li>
            <ul className="list-disc pl-4 space-y-1">
              <li>Olahraga (gowes, jogging, jalan santai): jangan memaksakan diri di luar kapasitas fisikmu, bawa air minum yang cukup.</li>
              <li>Explore Alam: perhatikan perkiraan cuaca, bawa perlengkapan yang sesuai medan, dan jangan menyimpang dari jalur/rombongan.</li>
              <li>Kulineran/Ngopi: sampaikan alergi atau pantangan makanan lebih awal ke host/anggota lain, dan pastikan kejelasan biaya sebelum ikut.</li>
            </ul>
            <li>Percayai insting — kalau ada yang terasa tidak beres, kamu berhak keluar dari circle atau berhenti berinteraksi kapan saja.</li>
          </ul>
        </Section>

        <Section title="5. Yang Tidak Diperbolehkan">
          <ul className="list-disc pl-4 space-y-1">
            <li>Pelecehan seksual, verbal, atau fisik dalam bentuk apa pun.</li>
            <li>Penipuan, termasuk memungut biaya tersembunyi tanpa persetujuan peserta.</li>
            <li>Akun palsu, spam, atau promosi yang tidak relevan.</li>
            <li>Konten atau perilaku yang membahayakan keselamatan orang lain.</li>
            <li>Diskriminasi berdasarkan suku, agama, ras, gender, atau kondisi fisik.</li>
          </ul>
        </Section>

        <Section title="6. Konsekuensi Pelanggaran">
          <p>Tergantung tingkat keparahan, tim kami dapat mengambil tindakan berupa:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Peringatan kepada pengguna yang bersangkutan.</li>
            <li>Penghapusan circle, komentar, atau konten yang melanggar.</li>
            <li>Penonaktifan sementara atau permanen akun pelanggar.</li>
          </ul>
        </Section>

        <Section title="7. Cara Melaporkan">
          <p>
            Kalau kamu menemukan circle atau pengguna yang melanggar panduan ini, laporkan langsung lewat
            tombol <span className="inline-flex items-center gap-1 font-medium"><Flag size={13} className="text-red-500" /> Laporkan</span>{" "}
            yang ada di halaman detail circle (menu titik tiga) atau di profil anggota circle. Tim kami akan
            meninjau setiap laporan yang masuk.
          </p>
        </Section>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Baca juga{" "}
        <Link href="/profile/syarat-ketentuan" className="text-primary font-medium">
          Syarat &amp; Ketentuan
        </Link>{" "}
        dan{" "}
        <Link href="/profile/kebijakan-privasi" className="text-primary font-medium">
          Kebijakan Privasi
        </Link>
        .
      </p>
      </div>
    </div>
  );
}

export default function PanduanKomunitasPage() {
  return (
    <Suspense fallback={null}>
      <PanduanKomunitasPageContent />
    </Suspense>
  );
}
