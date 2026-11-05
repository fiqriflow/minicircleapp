"use client";

import Link from "next/link";
import { Grid3x3 } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

export default function QuickAccessSection() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Circle yang tersedia</h2>
      <div className="grid grid-cols-4 gap-3">
        {CATEGORIES.slice(0, 3).map(({ label, icon: Icon }) => (
          <Link
            key={label}
            href={{ pathname: "/explore", query: { category: label } }}
            className="card-chunk flex flex-col items-center gap-2 bg-white p-3 text-center"
          >
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Icon size={20} />
            </div>
            <span className="text-xs font-bold leading-tight">{label}</span>
          </Link>
        ))}

        <Link
          href="/explore/categories"
          className="card-chunk flex flex-col items-center gap-2 bg-white p-3 text-center"
        >
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Grid3x3 size={20} />
          </div>
          <span className="text-xs font-bold leading-tight">Lihat Semua</span>
        </Link>
      </div>
    </section>
  );
}
