"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="font-semibold text-gray-800">{title}</h2>
      <div className="text-sm text-gray-600 space-y-2">{children}</div>
    </div>
  );
}

function KebijakanPrivasiPageContent() {
  const router = useRouter();
  const isEmbed = useSearchParams().get("embed") === "1";

  return (
    <div>
      {!isEmbed && (
        <div className="sticky top-0 z-10 bg-white border-b flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800" aria-label="Kembali">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl font-bold">Kebijakan Privasi</h1>
        </div>
      )}

      <div className="px-4 py-6 space-y-6 pb-16">
      <p className="text-xs text-gray-400">Terakhir diperbarui: 7 September 2026</p>

      <div className="bg-white rounded-2xl border p-4 space-y-6">
        <p className="text-sm text-gray-600">
          Kebijakan Privasi ini menjelaskan bagaimana Mincle mengumpulkan, menggunakan, dan melindungi data
          pribadi kamu saat menggunakan aplikasi. Dengan menggunakan Mincle, kamu menyetujui praktik yang
          dijelaskan di sini.
        </p>

        <Section title="1. Data yang Kami Kumpulkan">
          <ul className="list-disc pl-4 space-y-1">
            <li>Data akun dari Google saat login: nama, email, dan foto profil.</li>
            <li>Data profil yang kamu isi: nama panggilan, tanggal lahir, jenis kelamin, kategori aktivitas favorit (mis. Gowes, Jogging, Kulineran, Explore Alam, dsb.), kota domisili, akun Instagram, dan foto profil (opsional).</li>
            <li>Data lokasi kota yang kamu pilih, dipakai untuk menampilkan circle di sekitarmu (bukan lokasi GPS real-time).</li>
            <li>Data aktivitas dalam aplikasi: circle yang kamu buat/ikuti, komentar/chat di circle, dan riwayat join.</li>
            <li>Masukan, laporan (report), dan komunikasi lain yang kamu kirim ke kami.</li>
            <li>Data teknis dasar seperti status login (session) yang tersimpan sementara di perangkatmu.</li>
          </ul>
        </Section>

        <Section title="2. Bagaimana Kami Menggunakan Data">
          <ul className="list-disc pl-4 space-y-1">
            <li>Menyediakan dan menjalankan fitur inti: membuat/menemukan circle, join, dan berinteraksi dengan sesama pengguna, untuk berbagai jenis aktivitas (olahraga, kulineran, explore alam, dan lainnya).</li>
            <li>Menampilkan circle di sekitarmu berdasarkan kota yang kamu pilih.</li>
            <li>Menampilkan profil dasar kamu (nama panggilan, foto, kategori aktivitas) kepada pengguna lain di dalam circle yang sama, sebagai bagian normal dari fitur sosial aplikasi.</li>
            <li>Meninjau dan menindaklanjuti masukan serta laporan (report) demi keamanan komunitas.</li>
            <li>Menjaga keamanan aplikasi, mencegah penyalahgunaan, dan menegakkan Syarat & Ketentuan serta Panduan Komunitas.</li>
          </ul>
        </Section>

        <Section title="3. Dengan Siapa Data Dibagikan">
          <p>
            Kami tidak menjual data pribadimu. Data hanya diproses oleh penyedia layanan teknis yang kami
            gunakan untuk menjalankan aplikasi, yaitu penyedia autentikasi/hosting database (Supabase) dan
            layanan hosting aplikasi (Vercel), serta Google untuk proses login. Profil dasar (nama panggilan,
            foto, kategori aktivitas, Instagram jika diisi) juga terlihat oleh pengguna lain sesuai konteks
            circle yang kamu ikuti — ini bagian dari sifat sosial aplikasi, bukan pembagian ke pihak ketiga di
            luar Mincle.
          </p>
        </Section>

        <Section title="4. Penyimpanan & Keamanan Data">
          <p>
            Data disimpan selama akunmu masih aktif. Kami menerapkan kontrol akses (row level security) di
            level database sehingga data pribadi hanya bisa diakses oleh pemiliknya sendiri atau oleh Super
            Admin untuk keperluan moderasi/dukungan. Meski begitu, tidak ada sistem yang 100% bebas risiko —
            gunakan password/akun Google yang aman dan jangan bagikan akses akunmu ke orang lain.
          </p>
        </Section>

        <Section title="5. Hak Kamu atas Data">
          <ul className="list-disc pl-4 space-y-1">
            <li>Melihat dan mengubah data profil kapan saja lewat menu Akun {'>'} Data User.</li>
            <li>Menghapus akun beserta data profil secara mandiri lewat menu Akun {'>'} Data User {'>'} Hapus Akun.</li>
            <li>Meminta informasi lebih lanjut atau mengajukan keberatan lewat menu Masukan.</li>
          </ul>
          <p>
            Perlu dicatat, circle dan komentar yang pernah kamu buat/ikuti bisa tetap tersimpan sebagai bagian
            dari riwayat komunitas meski akunmu dihapus, dengan identitas host ditandai sebagai &quot;Akun
            Dihapus&quot;.
          </p>
        </Section>

        <Section title="6. Data Anak-anak">
          <p>
            Mincle tidak ditujukan untuk anak di bawah 13 tahun. Kami tidak dengan sengaja mengumpulkan data
            dari anak di bawah usia tersebut.
          </p>
        </Section>

        <Section title="7. Perubahan Kebijakan">
          <p>
            Kebijakan ini bisa diperbarui dari waktu ke waktu mengikuti perkembangan fitur aplikasi. Perubahan
            signifikan akan kami informasikan lewat aplikasi.
          </p>
        </Section>

        <Section title="8. Hubungi Kami">
          <p>Ada pertanyaan seputar privasi datamu? Kirim lewat menu Akun {'>'} Masukan.</p>
        </Section>
      </div>
      </div>
    </div>
  );
}

export default function KebijakanPrivasiPage() {
  return (
    <Suspense fallback={null}>
      <KebijakanPrivasiPageContent />
    </Suspense>
  );
}
