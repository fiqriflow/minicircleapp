"use client";

import Link from "next/link";

export default function CircleCreatedDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center space-y-4">
        <img src="/mascotsukses.svg" alt="Berhasil" className="w-32 h-32 mx-auto" />
        <div>
          <h2 className="font-bold text-lg">Circle Berhasil Dibuat!</h2>
          <p className="text-sm text-gray-500 mt-1">
            Circle kamu udah aktif. Kelola dan pantau line up-nya di My Circle.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/my-circle?tab=host"
            onClick={onClose}
            className="w-full bg-primary text-white rounded-xl py-3 font-medium"
          >
            Lihat di My Circle
          </Link>
          <button onClick={onClose} className="w-full py-2 text-gray-400 text-sm">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
