import Link from "next/link";
import { UserX } from "lucide-react";

export default function PendaftaranDitutupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center mx-auto">
          <UserX size={30} />
        </div>

        <h1 className="text-xl font-bold">Pendaftaran Sedang Ditutup</h1>

        <p className="text-sm text-gray-500">
          Kuota pendaftar baru Mincle untuk saat ini sudah penuh. Coba lagi lain waktu ya!
        </p>

        <Link href="/login" className="inline-block w-full border rounded-xl py-3 font-medium text-gray-600">
          Kembali ke Halaman Login
        </Link>
      </div>
    </div>
  );
}
