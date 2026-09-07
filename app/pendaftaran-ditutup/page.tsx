"use client";

import { useRouter } from "next/navigation";
import { UserX } from "lucide-react";

export default function PendaftaranDitutupPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-orange-50 text-primary flex items-center justify-center mx-auto">
          <UserX size={30} />
        </div>

        <h1 className="text-xl font-bold">Pendaftaran Ditutup Sementara</h1>

        <p className="text-sm text-gray-500">
          Kuota pendaftar baru Mincle sudah penuh saat ini. Coba lagi lain waktu, ya — kami akan buka
          pendaftaran lagi secepatnya.
        </p>

        <button
          onClick={() => router.replace("/login")}
          className="w-full border rounded-xl py-3 font-medium text-gray-600"
        >
          Kembali ke Halaman Masuk
        </button>
      </div>
    </div>
  );
}
