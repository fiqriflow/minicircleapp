"use client";

import { useEffect, useState } from "react";

const FLAG_KEY = "mincle_show_welcome";

export default function WelcomeDialog() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FLAG_KEY);
      if (raw) {
        setName(raw);
        sessionStorage.removeItem(FLAG_KEY);
      }
    } catch {}
  }, []);

  if (!name) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
        <img src="/mascotsukses.svg" alt="Berhasil" className="w-40 h-40 mx-auto" />
        <div>
          <h2 className="text-xl font-bold">Selamat Datang, {name}! 🎉</h2>
          <p className="text-sm text-gray-500 mt-1">
            Profil kamu udah lengkap. Yuk mulai cari atau bikin circle mabar pertamamu!
          </p>
        </div>
        <button onClick={() => setName(null)} className="w-full bg-primary text-white rounded-xl py-3 font-medium">
          Mulai Explore
        </button>
      </div>
    </div>
  );
}
