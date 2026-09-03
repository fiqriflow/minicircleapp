"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const FAQS = [
  {
    q: "Apa itu Mincle?",
    a: "Mincle adalah aplikasi untuk mencari dan bergabung dengan circle/komunitas olahraga (badminton, gowes, lari, jalan santai) di sekitarmu.",
  },
  {
    q: "Bagaimana cara join circle?",
    a: "Buka menu Explore, pilih circle yang kamu minati, lalu tekan tombol Join. Beberapa circle memerlukan persetujuan host sebelum kamu resmi bergabung.",
  },
  {
    q: "Bagaimana cara membuat circle sendiri?",
    a: "Tekan tombol tambah (+) di halaman Explore untuk membuat circle baru, lalu isi detail event seperti nama, lokasi, dan tanggal.",
  },
  {
    q: "Apa bedanya circle publik dan privat?",
    a: "Circle publik bisa ditemukan dan di-join siapa saja lewat Explore. Circle privat hanya bisa diikuti lewat undangan/kode dari host.",
  },
];

export default function FaqPage() {
  const router = useRouter();

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800" aria-label="Kembali">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">FAQ</h1>
      </div>

      <div className="space-y-3">
        {FAQS.map((item) => (
          <div key={item.q} className="bg-white rounded-2xl border p-4 space-y-1">
            <p className="font-medium text-sm">{item.q}</p>
            <p className="text-sm text-gray-500">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
