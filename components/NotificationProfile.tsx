"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

export default function NotificationProfile() {
  const [showNotif, setShowNotif] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShowNotif((s) => !s)}
        className="text-gray-500 hover:text-gray-800 relative"
        aria-label="Notifikasi"
      >
        <Bell size={22} />
      </button>
      {showNotif && (
        <div className="absolute right-0 mt-2 w-64 bg-white border rounded-xl shadow-lg p-4 z-50">
          <p className="text-sm font-semibold mb-2">Notifikasi</p>
          <p className="text-sm text-gray-400">Belum ada notifikasi.</p>
        </div>
      )}
    </div>
  );
}
