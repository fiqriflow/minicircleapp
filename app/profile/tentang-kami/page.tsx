"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function TentangKamiPage() {
  const router = useRouter();

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800" aria-label="Kembali">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">Tentang Kami</h1>
      </div>

      <div className="bg-white rounded-2xl border p-4 space-y-3 text-sm text-gray-600">
        <p>
          Mincle dibuat untuk memudahkan siapa saja mencari teman olahraga dan bergabung dengan komunitas
          circle di sekitarnya — mulai dari badminton, lari, gowes, hingga jalan santai.
        </p>
        <p>Punya masukan atau pertanyaan? Hubungi kami lewat kanal bantuan di aplikasi.</p>
      </div>
    </div>
  );
}
