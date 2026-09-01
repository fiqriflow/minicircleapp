"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export default function ComingSoonPage() {
  const router = useRouter();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 space-y-4">
      <Sparkles size={48} className="text-primary" />
      <h1 className="text-xl font-bold">Segera Hadir</h1>
      <p className="text-gray-500 max-w-sm">
        Fitur Circle+ sedang belum tersedia saat ini. Nantikan pembaruannya ya!
      </p>
      <button
        onClick={() => router.back()}
        className="text-primary font-medium underline"
      >
        Kembali
      </button>
    </div>
  );
}
