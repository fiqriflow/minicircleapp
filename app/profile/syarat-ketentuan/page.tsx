"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="font-semibold text-gray-800">{title}</h2>
      <div className="text-sm text-gray-600 space-y-2">{children}</div>
    </div>
  );
}

export default function SyaratKetentuanPage() {
  const router = useRouter();

  return (
    <div className="px-4 py-6 space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800" aria-label="Kembali">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">Syarat &amp; Ketentuan</h1>
      </div>

      <p className="text-xs text-gray-400">Terakhir diperbarui: 7 September 2026</p>

      <div className="bg-white rounded-2xl border p-4 space-y-6">
        <p className="text-sm text-gray-600">
          Dengan mendaftar dan menggunakan Mincle, kamu menyetujui Syarat &amp; Ketentuan berikut. Mohon dibaca
          dengan saksama.
        </p>

        <Section title="1. Tentang Layanan">
          <p>
            Mincle adalah aplikasi yang memfasilitasi orang untuk membentuk dan bergabung dengan &quot;circle&quot;
            — kelompok kecil untuk beraktivitas bareng, mencakup (namun tidak terbatas pada) olahraga (jogging,
            gowes, jalan santai), kulineran, ngopi, explore alam, dan motoran. Mincle hanya berperan sebagai
            penyedia platform pertemuan; kami bukan pihak penyelenggara aktivitas itu sendiri.
          </p>
        </Section>

        <Section title="2. Akun Pengguna">
          <ul className="list-disc pl-4 space-y-1">
            <li>Pendaftaran menggunakan akun Google. Kamu bertanggung jawab menjaga keamanan akunmu.</li>
            <li>Data profil yang kamu isi (nama, kategori aktivitas, kota, dsb.) harus akurat dan bukan menyamar sebagai orang lain.</li>
            <li>Satu akun hanya untuk digunakan oleh satu orang.</li>
            <li>Kami berhak menonaktifkan atau menghapus akun yang melanggar Syarat &amp; Ketentuan ini atau Panduan Komunitas.</li>
          </ul>
        </Section>

        <Section title="3. Perilaku Pengguna">
          <p>
            Kamu setuju untuk mengikuti Panduan Komunitas kami saat membuat circle, join circle, dan
            berinteraksi dengan pengguna lain. Dilarang keras: pelecehan, ujaran kebencian, penipuan, spam,
            konten tidak pantas, atau tindakan yang membahayakan pengguna lain.
          </p>
        </Section>

        <Section title="4. Risiko Aktivitas">
          <p>
            Circle yang dibentuk lewat Mincle melibatkan pertemuan dan aktivitas bersama orang yang mungkin
            baru kamu kenal, dengan risiko yang berbeda-beda tergantung jenis aktivitasnya — misalnya risiko
            cedera fisik pada circle olahraga, risiko keselamatan lalu lintas pada circle motoran, risiko
            cuaca/medan pada circle explore alam, hingga risiko alergi/keamanan pangan pada circle kulineran.
            Kamu mengikuti circle apa pun atas risiko dan tanggung jawab pribadi. Mincle tidak bertanggung
            jawab atas cedera, kecelakaan, kehilangan barang, atau kejadian tidak diinginkan lain yang terjadi
            selama atau akibat kegiatan circle. Selalu utamakan keselamatan — lihat Panduan Komunitas untuk
            tips keamanan per jenis aktivitas.
          </p>
        </Section>

        <Section title="5. Tanggung Jawab Host Circle">
          <p>
            Sebagai host (pembuat circle), kamu bertanggung jawab memberikan informasi circle yang jelas dan
            akurat (jenis aktivitas, lokasi, waktu, jumlah slot, serta kebutuhan khusus seperti kendaraan untuk
            motoran atau perkiraan biaya makan untuk kulineran). Host tidak diperkenankan memungut biaya di
            luar kesepakatan yang wajar dan transparan kepada peserta tanpa persetujuan mereka, dan wajib
            bersikap adil dalam menerima/menolak permintaan join.
          </p>
        </Section>

        <Section title="6. Laporan &amp; Moderasi">
          <p>
            Kamu bisa melaporkan circle atau pengguna yang melanggar aturan lewat fitur &quot;Laporkan&quot; di
            aplikasi. Tim kami akan meninjau setiap laporan dan dapat mengambil tindakan berupa peringatan,
            penghapusan konten/circle, hingga penonaktifan akun, tergantung tingkat pelanggaran.
          </p>
        </Section>

        <Section title="7. Konten Pengguna">
          <p>
            Kamu tetap memegang hak atas konten yang kamu unggah (foto profil, foto cover circle, komentar),
            namun memberi Mincle izin untuk menampilkan konten tersebut di dalam aplikasi sebagai bagian dari
            layanan.
          </p>
        </Section>

        <Section title="8. Fitur Circle+">
          <p>
            Circle+ adalah fitur tambahan yang mungkin memiliki ketentuan penggunaan khusus (misalnya
            persetujuan join manual). Ketentuan tambahan untuk fitur ini akan diinformasikan di dalam aplikasi
            saat fitur tersedia sepenuhnya.
          </p>
        </Section>

        <Section title="9. Penghentian Layanan">
          <p>
            Kami dapat menangguhkan atau menghentikan akses ke akunmu jika ditemukan pelanggaran serius
            terhadap Syarat &amp; Ketentuan atau Panduan Komunitas, tanpa mengurangi hakmu untuk mengajukan
            keberatan lewat menu Masukan.
          </p>
        </Section>

        <Section title="10. Perubahan Ketentuan">
          <p>
            Kami dapat memperbarui Syarat &amp; Ketentuan ini sewaktu-waktu. Penggunaan aplikasi setelah
            perubahan berlaku dianggap sebagai persetujuan atas ketentuan yang diperbarui.
          </p>
        </Section>

        <Section title="11. Hukum yang Berlaku">
          <p>Syarat &amp; Ketentuan ini diatur berdasarkan hukum yang berlaku di Republik Indonesia.</p>
        </Section>

        <Section title="12. Hubungi Kami">
          <p>Pertanyaan seputar Syarat &amp; Ketentuan bisa dikirim lewat menu Akun {'>'} Masukan.</p>
        </Section>
      </div>
    </div>
  );
}
