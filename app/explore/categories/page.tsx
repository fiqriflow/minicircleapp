"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

export default function SemuaCirclePage() {
  const router = useRouter();

  return (
    <div className="px-4 py-6 space-y-6">
      <button
        onClick={() => router.back()}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-400/80 text-white hover:bg-gray-500"
        aria-label="Kembali"
      >
        <ArrowLeft size={18} />
      </button>

      <h1 className="text-xl font-bold">Semua Circle</h1>

      <div className="grid grid-cols-4 gap-3">
        {CATEGORIES.map(({ label, icon: Icon }) => (
          <Link
            key={label}
            href={{ pathname: "/explore", query: { category: label } }}
            className="flex flex-col items-center gap-2 bg-white border rounded-2xl p-3 hover:border-primary hover:bg-primary/5 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Icon size={20} />
            </div>
            <span className="text-xs font-medium leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
